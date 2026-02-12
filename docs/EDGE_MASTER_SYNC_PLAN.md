# Edge ↔ Master Sync Plan (Champion Tatami Control + Champion Arena)

## 1) Purpose

This document defines the target architecture and implementation plan for reliable offline-first tournament operation, with:

- **Edge app** (`champion-tatami-control`) as active runtime during tournament.
- **Master app** (`champion-arena`) as central system and eventual consistency target.
- Deterministic, idempotent sync via outbox/inbox.
- No destructive full DB replacement sync.

---

## 2) Core principles

1. **Single writer during event runtime**
   - During live operation, Edge is source of truth for match progress and operational edits.
   - Master receives commands/events from Edge.

2. **Offline-first**
   - Edge always operates without internet.
   - Outgoing updates are queued and retried.

3. **No destructive sync**
   - Remove "delete all and recreate" sync flows.
   - Use versioned upsert + conflict detection.

4. **Bracket-level safety**
   - Bracket mutability is controlled by state.
   - Running brackets are immutable structurally.

5. **Manual pull from master**
   - Pull is explicit by operator action.
   - Pull allowed only after sync barrier is satisfied.

---

## 3) Domain model decisions

## 3.1 Bracket lifecycle state

Add `state` to brackets (both Edge and Master):

- `draft` — editable.
- `locked` — pre-start locked but still non-running.
- `running` — live; structural edits forbidden.
- `finished` — immutable.

## 3.2 Versioning

Add `version` (int) to mutable aggregates (`bracket` at minimum):

- Increment `version` on every structural change:
  - participants add/remove/reseed,
  - bracket type/regeneration,
  - repechage structure updates,
  - team structure updates (future).

Match score/status updates may either:
- increment bracket version too (simplest global model), or
- have own match version (more complex, optional later).

Initial implementation: **increment bracket version on any match state transition in that bracket** for strict ordering.

## 3.3 External identity mapping

Maintain stable mapping:

- `edge_id` (installation/node ID)
- `external_id` on key entities (already partly present in tatami-control)

Never rely on transient positional matching.

---

## 4) Sync transport model

## 4.1 Outbox (Edge)

Outbox table fields:

- `id` (uuid)
- `edge_id` (string)
- `seq` (bigint, strictly monotonic per edge)
- `event_type` (enum/string)
- `aggregate_type` (`bracket`, `match`, etc.)
- `aggregate_id` (local ID + optional external reference)
- `aggregate_version` (int)
- `payload` (jsonb)
- `status` (`pending`, `processing`, `sent`, `failed`, `dead`)
- `attempts` (int)
- `next_retry_at` (timestamp)
- `last_error` (text)
- `created_at`, `updated_at`

Indexes:

- `(status, next_retry_at)`
- `(edge_id, seq)` unique

Worker behavior:

- FIFO by `seq`.
- Exponential backoff with cap.
- Mark `dead` after max attempts.
- Idempotent retries must be safe.

## 4.2 Inbox (Master)

Inbox/dedup table fields:

- `event_id` (uuid)
- `edge_id`
- `seq`
- `received_at`
- `applied` (bool)
- `error` (nullable)

Unique key:

- `(edge_id, seq)`

Master applies each event once.

## 4.3 Sync barrier (critical)

Before pulling from master, Edge must verify master has applied all local outbound events.

Watermarks:

- Edge local: `last_sent_seq`
- Master per edge: `last_applied_seq`

Pull allowed only if:

- `master.last_applied_seq >= edge.last_sent_seq`

If not, pull is blocked with clear UI message.

---

## 5) API contracts (target)

## 5.1 Edge -> Master commands

`POST /sync/commands`

Request:

```json
{
  "edge_id": "tatami-node-01",
  "events": [
    {
      "event_id": "uuid",
      "seq": 10234,
      "event_type": "match.finished",
      "aggregate_type": "match",
      "aggregate_id": "local_or_external_match_id",
      "aggregate_version": 17,
      "occurred_at": "2026-02-02T12:00:00Z",
      "payload": {
        "score_athlete1": 2,
        "score_athlete2": 1,
        "winner_id": 123
      }
    }
  ]
}
```

Response:

```json
{
  "accepted": [10234],
  "duplicates": [],
  "conflicts": [
    {
      "seq": 10235,
      "reason": "version_conflict",
      "expected_version": 18,
      "received_version": 17
    }
  ],
  "last_applied_seq": 10234
}
```

## 5.2 Edge checks sync status

`GET /sync/status/{edge_id}`

Response:

```json
{
  "edge_id": "tatami-node-01",
  "last_applied_seq": 10234,
  "server_time": "2026-02-02T12:01:00Z"
}
```

## 5.3 Manual pull (Edge from Master)

Two-step pull:

1. `GET /sync/pull-preview?since_cursor=...`
2. `POST /sync/pull-apply`

Preview response includes:

- changed aggregates
- conflicts forecast (`running/finished`, version mismatch)

Apply request may include policy:

```json
{
  "apply_mode": "safe_only",
  "skip_running": true,
  "skip_finished": true,
  "expected_barrier_seq": 10234
}
```

Master/Edge should reject apply if barrier no longer holds.

---

## 6) Conflict policy

## 6.1 Structural conflicts

If local bracket is `running` or `finished`:

- never overwrite from pull.
- show conflict report.

If local bracket is `draft/locked` but version diverged:

- require operator decision:
  - keep local,
  - apply remote,
  - manual merge (future).

## 6.2 Match-state conflicts

If master has older match state than edge:

- edge event should re-apply (idempotent command).

If master has newer state than edge pull target:

- edge pulls only when barrier holds, so this should be rare;
- still handle gracefully with version checks.

---

## 7) Bracket editing rules during tournament

1. Only non-running brackets are structurally editable.
2. Running bracket: match operations only (start/score/finish).
3. Regeneration allowed only for `draft/locked`.
4. Team/repechage future logic follows same state/version rules.

---

## 8) Remove duplication strategy

Current pain: duplicate business logic between master and edge.

Target:

- shared package (internal/private) for:
  - bracket generation,
  - repechage generation,
  - placement calculations,
  - validation rules.

Implementation options:

1. Monorepo shared Python package (`libs/champion_domain`) imported by both backends.
2. Separate private package versioned and pinned in both projects.

Recommendation: start with monorepo-local shared library to move faster.

---

## 9) Data migration and rollout plan

## Phase A (safety baseline)

- Add `state`, `version` to brackets (both systems).
- Enforce edit guards for `running/finished`.
- Add outbox `seq` + strict ordering.
- Add master inbox dedup and `last_applied_seq` tracking.

## Phase B (transport hardening)

- Implement `sync/status` barrier endpoint.
- Update outbox worker to use ack semantics.
- Add dead-letter and operator visibility.

## Phase C (manual pull)

- Implement preview + apply flow.
- Add conflict reporting UI.
- Block pull without barrier.

## Phase D (remove legacy sync)

- Deprecate `sync.py` destructive replace path.
- Replace with versioned upsert/diff application.

## Phase E (domain unification)

- Move repeated bracket/match logic to shared domain package.

---

## 10) Minimal DB changes (first concrete migration set)

Edge DB:

- `brackets.state` varchar default `draft`
- `brackets.version` int default `1`
- `outbox_items.seq` bigint not null
- `outbox_items.edge_id` varchar not null
- unique `(edge_id, seq)`
- optional `sync_meta` table for local watermarks

Master DB:

- `brackets.state`, `brackets.version` (if not present)
- `sync_inbox_events` table
- `sync_edge_state` table:
  - `edge_id` PK
  - `last_applied_seq`
  - `updated_at`

---

## 11) Observability and ops

Required metrics:

- outbox pending count
- outbox oldest pending age
- failed/dead counts
- last successful send timestamp
- master last_applied_seq lag (`edge_last_sent - master_last_applied`)

Required admin screens:

- Outbox queue with retries/errors
- Sync barrier status
- Pull preview/conflict report

---

## 12) Security and integrity

- Commands signed/authenticated with service token.
- `edge_id` bound to token identity.
- Reject malformed or out-of-order payloads.
- Idempotency keys mandatory.

---

## 13) Open questions (to finalize before coding)

1. Should match updates increment bracket version, or do we introduce per-match version now?
   - Proposed now: increment bracket version for simplicity.

2. Do we need bi-directional near-real-time sync later, or manual pull is enough?
   - Proposed now: manual pull only.

3. For conflicts on `draft/locked`, do we allow forced overwrite from master?
   - Proposed now: yes, explicit operator action only.

---

## 14) Immediate implementation checklist

1. Add migrations (`state`, `version`, outbox seq/edge_id, master inbox tables).
2. Implement outbox worker ordered by `(edge_id, seq)`.
3. Implement master `POST /sync/commands` + dedup + version checks.
4. Implement `GET /sync/status/{edge_id}`.
5. Wire Edge UI: block pull until barrier satisfied.
6. Implement pull preview/apply with safe-only mode.
7. Remove destructive sync path from `backend/src/services/sync.py`.

---

## 15) Non-goals for current iteration

- Full automatic merge of conflicting running brackets.
- Advanced CRDT/event-sourcing for all aggregates.
- Team kumite domain details (will be layered on this foundation).


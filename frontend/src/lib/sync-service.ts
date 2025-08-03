import { apiClient } from "./api";
import {
  tournamentService,
  bracketService,
  athleteService,
  matchService,
  bracketMatchService,
  prisma,
} from "./database";

export class SyncService {
  async syncTournament(tournamentId: number) {
    try {
      console.log(`Starting sync for tournament ${tournamentId}`);

      const tournament = await apiClient.getTournament(tournamentId);
      if (!tournament) {
        throw new Error(`Tournament ${tournamentId} not found`);
      }

      // Create or update tournament
      await tournamentService.createOrUpdate({
        externalId: tournament.id,
        name: tournament.name,
        location: tournament.location,
        startDate: tournament.start_date ? new Date(tournament.start_date) : undefined,
        endDate: tournament.end_date ? new Date(tournament.end_date) : undefined,
        status: tournament.status,
      });

      // Get existing brackets for this tournament
      const existingBrackets = await bracketService.getByTournamentExternalId(tournament.id);

      // Delete only matches that are not started or finished
      for (const bracket of existingBrackets) {
        // Get bracket matches that are not started or finished
        const unfinishedBracketMatches = await prisma.bracketMatch.findMany({
          where: {
            bracketId: bracket.id,
            match: {
              status: { notIn: ["started", "finished"] },
            },
          },
          include: { match: true },
        });

        for (const bracketMatch of unfinishedBracketMatches) {
          // Delete match state
          await prisma.matchState.deleteMany({
            where: { matchId: bracketMatch.matchId },
          });

          // Delete bracket match
          await prisma.bracketMatch.delete({
            where: { id: bracketMatch.id },
          });

          // Delete the match
          await prisma.match.delete({
            where: { id: bracketMatch.matchId },
          });
        }
      }

      // Fetch all brackets with matches in one call
      const bracketsWithMatches = await apiClient.getTournamentMatchesFull(tournamentId);

      for (const bracketData of bracketsWithMatches) {
        // Create or update bracket
        await bracketService.createOrUpdate({
          externalId: bracketData.bracket_id,
          tournamentExternalId: tournament.id,
          category: bracketData.category,
          type: bracketData.type,
          tatami: bracketData.tatami,
          groupId: bracketData.group_id ?? 1,
          startTime: bracketData.start_time ?? "09:00",
          status: bracketData.status,
          displayName: bracketData.display_name ?? bracketData.category,
        });

        // Process matches for this bracket
        for (const bracketMatch of bracketData.matches) {
          const match = bracketMatch.match;

          // Store athletes (can be null for advancing winners)
          let athlete1Id: number | undefined;
          let athlete2Id: number | undefined;

          if (match.athlete1) {
            const athlete1 = await athleteService.createOrUpdate({
              externalId: match.athlete1.id,
              firstName: match.athlete1.first_name,
              lastName: match.athlete1.last_name,
              coachesLastName: Array.isArray(match.athlete1.coaches_last_name)
                ? match.athlete1.coaches_last_name.join(", ")
                : match.athlete1.coaches_last_name || "",
            });
            athlete1Id = athlete1.id;
          }

          if (match.athlete2) {
            const athlete2 = await athleteService.createOrUpdate({
              externalId: match.athlete2.id,
              firstName: match.athlete2.first_name,
              lastName: match.athlete2.last_name,
              coachesLastName: Array.isArray(match.athlete2.coaches_last_name)
                ? match.athlete2.coaches_last_name.join(", ")
                : match.athlete2.coaches_last_name || "",
            });
            athlete2Id = athlete2.id;
          }

          // Create match even with one athlete (for tournament progression)
          await matchService.createOrUpdate({
            externalId: match.id,
            athlete1ExternalId: athlete1Id,
            athlete2ExternalId: athlete2Id,
            winnerExternalId: match.winner?.id,
            scoreAthlete1: match.score_athlete1,
            scoreAthlete2: match.score_athlete2,
            status: match.status,
            startedAt: match.started_at ? new Date(match.started_at) : null,
            endedAt: match.ended_at ? new Date(match.ended_at) : null,
          });

          await bracketMatchService.createOrUpdate({
            externalId: bracketMatch.id,
            bracketExternalId: bracketData.bracket_id,
            matchExternalId: match.id,
            roundNumber: bracketMatch.round_number,
            position: bracketMatch.position,
            nextSlot: bracketMatch.next_slot ?? null,
          });
        }
      }

      console.log(`Sync completed for tournament ${tournamentId}`);
    } catch (err) {
      console.error("Sync failed:", err);
      throw err;
    }
  }
}

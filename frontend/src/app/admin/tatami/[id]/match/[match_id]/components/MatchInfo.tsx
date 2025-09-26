import { ExternalMatch } from "@/lib/interfaces";

interface MatchInfoProps {
  currentMatch: ExternalMatch | null;
  matchId: string;
  tatamiId: string;
}

export function MatchInfo({ currentMatch, matchId, tatamiId }: MatchInfoProps) {
  return (
    <div className="border rounded-lg p-4 bg-blue-50">
      <h3 className="text-lg font-semibold mb-2">Current Match</h3>
      {currentMatch ? (
        <div className="space-y-2">
          <div>
            <strong>Athlete 1:</strong>{" "}
            {currentMatch.athlete1
              ? `${currentMatch.athlete1.last_name} ${currentMatch.athlete1.first_name} (${currentMatch.athlete1.coaches_last_name})`
              : "TBD"}
          </div>
          <div>
            <strong>Athlete 2:</strong>{" "}
            {currentMatch.athlete2
              ? `${currentMatch.athlete2.last_name} ${currentMatch.athlete2.first_name} (${currentMatch.athlete2.coaches_last_name})`
              : "TBD"}
          </div>
          <div>
            <strong>Status:</strong> {currentMatch.status}
          </div>
          <div>
            <strong>Match ID:</strong> {matchId}
          </div>
        </div>
      ) : (
        <div className="text-gray-600">
          No match selected. Please go to{" "}
          <a href={`/admin/tatami/${tatamiId}`} className="text-blue-600 underline">
            Match Setup
          </a>{" "}
          to select a match.
        </div>
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Match } from "@/lib/api";

interface MatchControlsProps {
  status: string;
  currentMatch: Match | null;
  onStartMatch: () => void;
  onPause: () => void;
  onResume: () => void;
  onSync: () => void;
  onFinishMatch: () => void;
}

export function MatchControls({
  status,
  currentMatch,
  onStartMatch,
  onPause,
  onResume,
  onSync,
  onFinishMatch,
}: MatchControlsProps) {
  const handlePauseResume = () => {
    if (status === "running") {
      onPause();
    } else {
      onResume();
    }
  };
  return (
    <>
      {/* Match Controls */}
      <div className="flex justify-center space-x-2">
        <Button
          onClick={onStartMatch}
          disabled={status === "running" || currentMatch?.status === "started"}
          className="bg-green-600 hover:bg-green-700"
        >
          Start Match
        </Button>
        <Button onClick={handlePauseResume} variant="secondary" disabled={status === "idle"}>
          {status === "running" ? "Pause" : "Resume"}
        </Button>
        <Button onClick={onSync} variant="outline">
          Sync
        </Button>
      </div>

      {/* Match Status */}
      <div className="text-center">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            currentMatch?.status === "not_started"
              ? "bg-gray-100 text-gray-800"
              : currentMatch?.status === "started"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {currentMatch?.status === "not_started"
            ? "Not Started"
            : currentMatch?.status === "started"
            ? "Match Started"
            : "Match Finished"}
        </span>

        {currentMatch?.status === "started" && (
          <div className="mt-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Finish Match
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Finish Match</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to finish this match? This action cannot be undone and will send a completion
                    signal to the backend.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="destructive" onClick={onFinishMatch}>
                    Finish Match
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </>
  );
}

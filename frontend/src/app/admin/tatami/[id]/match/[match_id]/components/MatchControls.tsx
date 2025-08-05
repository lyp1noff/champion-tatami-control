import { Button } from "@/components/ui/button";

interface MatchControlsProps {
  status: string;
  onPause: () => void;
  onResume: () => void;
  onSync: () => void;
}

export function MatchControls({ status, onPause, onResume, onSync }: MatchControlsProps) {
  return (
    <>
      {/* Match Controls */}
      <div className="flex justify-center space-x-2">
        {status === "running" && <Button onClick={onPause}>Pause</Button>}
        {status === "idle" && <Button onClick={onResume}>Start</Button>}
        {status === "paused" && <Button onClick={onResume}>Resume</Button>}
        <Button onClick={onSync} variant="outline">
          Sync
        </Button>
      </div>
    </>
  );
}

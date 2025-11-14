import { Button } from "@/components/ui/button";

interface MatchControlsProps {
  status: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function MatchControls({ status, onStart, onPause, onResume }: MatchControlsProps) {
  return (
    <>
      {/* Match Controls */}
      <div className="flex justify-center space-x-2">
        {status === "running" && <Button onClick={onPause}>Pause</Button>}
        {status === "idle" && <Button onClick={onStart}>Start</Button>}
        {status === "paused" && <Button onClick={onResume}>Resume</Button>}
      </div>
    </>
  );
}

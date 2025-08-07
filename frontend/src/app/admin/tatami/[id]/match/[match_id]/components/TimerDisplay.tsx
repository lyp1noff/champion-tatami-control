interface TimerDisplayProps {
  remaining: number;
  durationMs: number;
}

export function TimerDisplay({ remaining, durationMs }: TimerDisplayProps) {
  const format = (ms: number) => {
    const clamped = Math.max(0, ms);
    const s = Math.floor(clamped / 1000);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    const remMS = Math.floor((clamped % 1000) / 10);
    return `${String(m).padStart(2, "0")}:${String(remS).padStart(2, "0")}.${String(remMS).padStart(2, "0")}`;
  };

  return (
    <div className="text-center">
      <div className="text-6xl font-mono mb-2">{format(remaining)}</div>
      <div className="text-sm text-gray-600">
        Duration: {Math.floor(durationMs / 60000)}:{String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0")}
      </div>
    </div>
  );
}

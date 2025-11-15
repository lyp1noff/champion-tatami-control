import { Button } from "@/components/ui/button";
import { ExternalMatch } from "@/lib/interfaces";

interface FighterControlsProps {
  currentMatch: ExternalMatch | null;
  score1: number;
  score2: number;
  shido1: number;
  shido2: number;
  senshu: number;
  swap_status: boolean;
  onAdjustScore: (fighter: 1 | 2, delta: number) => void;
  onSetShido: (fighter: 1 | 2, value: number) => void;
  onSetSenshu: (fighter_or_zero: 0 | 1 | 2) => void;
}

export function FighterControls({
  currentMatch,
  score1,
  score2,
  shido1,
  shido2,
  senshu,
  swap_status,
  onAdjustScore,
  onSetShido,
  onSetSenshu,
}: FighterControlsProps) {
  const fighters = swap_status ? [2, 1] : [1, 2];
  const disabled = currentMatch?.status !== "started";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {fighters.map((id) => {
        const athlete = id === 1 ? currentMatch?.athlete1 : currentMatch?.athlete2;
        const athleteName = athlete
          ? `${athlete.last_name} ${athlete.first_name} (${athlete.coaches_last_name})`
          : `Fighter ${id}`;

        return (
          <div key={id} className="border rounded-lg p-4">
            <h3 className={`font-semibold text-xl mb-2 ${id === 1 ? "text-red-500" : "text-blue-500"}`}>
              {athleteName}
            </h3>

            {/* Score */}
            <div className="mb-4">
              <div className="flex flex-row pb-2">
                <Button
                  disabled={disabled}
                  variant="outline"
                  onClick={() => onSetSenshu(senshu === id ? 0 : (id as 1 | 2))}
                  className={`size-sm w-10 transition-color ${
                    senshu === id ? "bg-green-500 hover:bg-green-600" : "bg-transparent"
                  }`}
                >
                  S
                </Button>
                <p className="ml-2 text-2xl font-bold flex items-center">Score: {id === 1 ? score1 : score2}</p>
              </div>
              <div className="flex flex-col gap-2">
                {/* Plus buttons */}
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3].map((v) => (
                    <Button
                      disabled={disabled}
                      key={v}
                      variant="outline"
                      className="w-10"
                      size="sm"
                      onClick={() => onAdjustScore(id as 1 | 2, v)}
                    >
                      +{v}
                    </Button>
                  ))}
                </div>
                {/* Minus buttons */}
                <div className="flex gap-2 justify-center">
                  {[-1, -2, -3].map((v) => (
                    <Button
                      disabled={disabled}
                      key={v}
                      variant="outline"
                      className="w-10"
                      size="sm"
                      onClick={() => onAdjustScore(id as 1 | 2, v)}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Shido */}
            <div>
              <div className="flex gap-2 flex-wrap justify-center">
                {[
                  { value: 0, label: "None" },
                  { value: 1, label: "C1" },
                  { value: 2, label: "C2" },
                  { value: 3, label: "C3" },
                  { value: 4, label: "HC" },
                  { value: 5, label: "H" },
                ].map(({ value, label }) => (
                  <Button
                    disabled={disabled}
                    key={value}
                    variant={value === (id === 1 ? shido1 : shido2) ? "default" : "outline"}
                    size="sm"
                    onClick={() => onSetShido(id as 1 | 2, value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { ExternalMatch } from "@/lib/interfaces";

interface FighterControlsProps {
  currentMatch: ExternalMatch | null;
  score1: number;
  score2: number;
  shido1: number;
  shido2: number;
  onAdjustScore: (fighter: 1 | 2, delta: number) => void;
  onSetShido: (fighter: 1 | 2, value: number) => void;
}

export function FighterControls({
  currentMatch,
  score1,
  score2,
  shido1,
  shido2,
  onAdjustScore,
  onSetShido,
}: FighterControlsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[1, 2].map((id) => {
        const athlete = id === 1 ? currentMatch?.athlete1 : currentMatch?.athlete2;
        const athleteName = athlete
          ? `${athlete.first_name} ${athlete.last_name} (${athlete.coaches_last_name})`
          : `Fighter ${id}`;

        return (
          <div key={id} className="border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3">{athleteName}</h3>

            {/* Score */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Score: <span className="font-bold text-lg">{id === 1 ? score1 : score2}</span>
              </p>
              <div className="flex flex-col gap-2">
                {/* Plus buttons */}
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3].map((v) => (
                    <Button
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

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalMatch } from "@/lib/interfaces";
import { useState } from "react";

interface FinishMatchDialogProps {
  currentMatch: ExternalMatch | null;
  score1: number;
  score2: number;
  swap_status: boolean;
  onFinishMatch: (winnerId: number) => void;
}

export function FinishMatchDialog({
  currentMatch,
  score1,
  score2,
  swap_status,
  onFinishMatch,
}: FinishMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<number>(0);

  const getDefaultWinner = () => {
    if (score1 > score2) {
      return currentMatch?.athlete1?.id || 0;
    } else if (score2 > score1) {
      return currentMatch?.athlete2?.id || 0;
    }
    return currentMatch?.athlete1?.id || 0;
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedWinner(getDefaultWinner());
    }
  };

  const handleFinish = () => {
    onFinishMatch(selectedWinner);
    setOpen(false);
  };

  const fighters = swap_status ? [2, 1] : [1, 2];

  const getFighter = (id: 1 | 2) => {
    const athlete = id === 1 ? currentMatch?.athlete1 : currentMatch?.athlete2;
    const score = id === 1 ? score1 : score2;
    return {
      id: athlete?.id || 0,
      name: athlete ? `${athlete.last_name} ${athlete.first_name}` : `Fighter ${id}`,
      score,
      colorClass: id === 1 ? "text-red-600" : "text-blue-600",
    };
  };

  const f1 = getFighter(fighters[0] as 1 | 2);
  const f2 = getFighter(fighters[1] as 1 | 2);

  return (
    <div className="border rounded-lg p-4 border-red-500 bg-red-50">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-red-800">Finish Match</h3>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Finish Match
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Finish Match</DialogTitle>
              <DialogDescription>
                Review the final scores and select the winner. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Score Display */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 border rounded-lg">
                  <div className={`text-2xl font-bold ${f1.colorClass}`}>{f1.score}</div>
                  <div className="text-sm text-gray-600">{f1.name}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className={`text-2xl font-bold ${f2.colorClass}`}>{f2.score}</div>
                  <div className="text-sm text-gray-600">{f2.name}</div>
                </div>
              </div>

              {/* Winner Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Winner</label>
                <Select value={selectedWinner.toString()} onValueChange={(value) => setSelectedWinner(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select winner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={f1.id.toString()}>
                      {f1.name} ({f1.score} points)
                    </SelectItem>
                    <SelectItem value={f2.id.toString()}>
                      {f2.name} ({f2.score} points)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleFinish}>
                Finish Match
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

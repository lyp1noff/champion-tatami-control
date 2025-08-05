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
  onFinishMatch: (winnerId: number) => void;
}

export function FinishMatchDialog({ currentMatch, score1, score2, onFinishMatch }: FinishMatchDialogProps) {
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

  const athlete1Name = currentMatch?.athlete1
    ? `${currentMatch.athlete1.first_name} ${currentMatch.athlete1.last_name}`
    : "Fighter 1";

  const athlete2Name = currentMatch?.athlete2
    ? `${currentMatch.athlete2.first_name} ${currentMatch.athlete2.last_name}`
    : "Fighter 2";

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
                  <div className="text-2xl font-bold text-red-600">{score1}</div>
                  <div className="text-sm text-gray-600">{athlete1Name}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{score2}</div>
                  <div className="text-sm text-gray-600">{athlete2Name}</div>
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
                    <SelectItem value={currentMatch?.athlete1?.id?.toString() || "0"}>
                      {athlete1Name} ({score1} points)
                    </SelectItem>
                    <SelectItem value={currentMatch?.athlete2?.id?.toString() || "0"}>
                      {athlete2Name} ({score2} points)
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

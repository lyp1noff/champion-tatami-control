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

interface TimeAdjustmentProps {
  status: string;
  timeAdjustInput: { minutes: number; seconds: number; milliseconds: number };
  showTimeAdjustDialog: boolean;
  onTimeAdjustInputChange: (field: "minutes" | "seconds" | "milliseconds", value: number) => void;
  onShowTimeAdjustDialogChange: (show: boolean) => void;
  onSaveTimeAdjustment: () => void;
}

export function TimeAdjustment({
  status,
  timeAdjustInput,
  showTimeAdjustDialog,
  onTimeAdjustInputChange,
  onShowTimeAdjustDialogChange,
  onSaveTimeAdjustment,
}: TimeAdjustmentProps) {
  if (status !== "paused") return null;

  return (
    <div className="border rounded-lg p-4 border-yellow-500 bg-yellow-50">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-yellow-800">Time Adjustment</h3>
        <Dialog open={showTimeAdjustDialog} onOpenChange={onShowTimeAdjustDialogChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-yellow-800 border-yellow-500">
              Adjust Time
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Remaining Time</DialogTitle>
              <DialogDescription>Set the remaining time for the match.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 justify-center py-4">
              <input
                type="number"
                min="0"
                max="59"
                value={timeAdjustInput.minutes}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  onTimeAdjustInputChange("minutes", value);
                }}
                className="w-20 px-3 py-2 border rounded text-center text-lg"
                placeholder="M"
              />
              <span className="text-lg font-bold">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={timeAdjustInput.seconds}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  onTimeAdjustInputChange("seconds", value);
                }}
                className="w-20 px-3 py-2 border rounded text-center text-lg"
                placeholder="S"
              />
              <span className="text-lg font-bold">.</span>
              <input
                type="number"
                min="0"
                max="99"
                value={timeAdjustInput.milliseconds}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  onTimeAdjustInputChange("milliseconds", value);
                }}
                className="w-20 px-3 py-2 border rounded text-center text-lg"
                placeholder="MS"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onShowTimeAdjustDialogChange(false)}>
                Cancel
              </Button>
              <Button onClick={onSaveTimeAdjustment}>Save Time</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

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

interface TimeSettingProps {
  timeSettingInput: { minutes: number; seconds: number };
  showTimeSettingDialog: boolean;
  onTimeSettingInputChange: (field: "minutes" | "seconds", value: number) => void;
  onShowTimeSettingDialogChange: (show: boolean) => void;
  onSaveTimeSetting: () => void;
}

export function TimeSetting({
  timeSettingInput,
  showTimeSettingDialog,
  onTimeSettingInputChange,
  onShowTimeSettingDialogChange,
  onSaveTimeSetting,
}: TimeSettingProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Time Setting</h3>
        <Dialog open={showTimeSettingDialog} onOpenChange={onShowTimeSettingDialogChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Setting Time
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Setting Match Time</DialogTitle>
              <DialogDescription>Set total time for the match.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 justify-center py-4">
              <input
                type="number"
                min="0"
                max="59"
                value={timeSettingInput.minutes}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  onTimeSettingInputChange("minutes", value);
                }}
                className="w-20 px-3 py-2 border rounded text-center text-lg"
                placeholder="M"
              />
              <span className="text-lg font-bold">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={timeSettingInput.seconds}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  onTimeSettingInputChange("seconds", value);
                }}
                className="w-20 px-3 py-2 border rounded text-center text-lg"
                placeholder="S"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onShowTimeSettingDialogChange(false)}>
                Cancel
              </Button>
              <Button onClick={onSaveTimeSetting}>Save Time</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

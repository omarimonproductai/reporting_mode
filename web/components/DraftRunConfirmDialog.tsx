"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: () => void;
  briefName?: string;
};

export function DraftRunConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  briefName,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Brief despublicat</DialogTitle>
          <DialogDescription>
            {briefName ? (
              <>
                Aquest brief (<strong>{briefName}</strong>) està en mode
                Draft — el cron no l&apos;executa automàticament. Vols
                executar-lo manualment ara?
              </>
            ) : (
              <>
                Aquest brief està en mode Draft — el cron no l&apos;executa
                automàticament. Vols executar-lo manualment ara?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Run anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

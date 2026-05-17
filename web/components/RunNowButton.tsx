"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftRunConfirmDialog } from "@/components/DraftRunConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMmSs, useRunNow } from "@/hooks/useRunNow";
import { isDryRunFresh } from "@/lib/dryRunTracking";

type Props =
  | { mode: "create" }
  | {
      mode: "existing";
      filename: string;
      // Persisted publish state. Drafts get a confirmation dialog before
      // dispatch; the default `true` keeps existing call-sites (that
      // haven't been updated to pass the prop) safe.
      published?: boolean;
      briefName?: string;
    };

export function RunNowButton(props: Props) {
  if (props.mode === "create") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button type="button" size="sm" disabled>
              <Play />
              Run Now
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Crea el brief abans de poder executar-lo.
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <RunNowButtonExisting
      filename={props.filename}
      published={props.published ?? true}
      briefName={props.briefName}
    />
  );
}

function RunNowButtonExisting({
  filename,
  published,
  briefName,
}: {
  filename: string;
  published: boolean;
  briefName?: string;
}) {
  const { running, onCooldown, remainingSeconds, dispatch } =
    useRunNow(filename);
  const [draftConfirmOpen, setDraftConfirmOpen] = useState(false);
  const [previewWarnOpen, setPreviewWarnOpen] = useState(false);
  const disabled = running || onCooldown;
  const label = running
    ? "Running…"
    : onCooldown
      ? `Run Now — torna a provar en ${formatMmSs(remainingSeconds)}`
      : "Run Now";

  // Stacked confirmations:
  // 1. Draft? → DraftRunConfirmDialog (warns about publishing an
  //    in-progress brief).
  // 2. Otherwise no recent dry-run? → preview-warn Dialog (warns
  //    about dispatching without having validated the output first,
  //    task 18.0).
  // 3. Otherwise → dispatch directly.
  function onClick() {
    if (disabled) return;
    if (!published) {
      setDraftConfirmOpen(true);
      return;
    }
    if (!isDryRunFresh(filename)) {
      setPreviewWarnOpen(true);
      return;
    }
    void dispatch();
  }

  function onDraftConfirm() {
    setDraftConfirmOpen(false);
    // After confirming the draft warning, ALSO surface the preview
    // warning if applicable — the two gates compose.
    if (!isDryRunFresh(filename)) {
      setPreviewWarnOpen(true);
      return;
    }
    void dispatch();
  }

  function onPreviewConfirm() {
    setPreviewWarnOpen(false);
    void dispatch();
  }

  return (
    <>
      <Button type="button" size="sm" disabled={disabled} onClick={onClick}>
        <Play />
        {label}
      </Button>
      <DraftRunConfirmDialog
        open={draftConfirmOpen}
        onOpenChange={setDraftConfirmOpen}
        onConfirm={onDraftConfirm}
        briefName={briefName}
      />
      <Dialog open={previewWarnOpen} onOpenChange={setPreviewWarnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar Run Now sense Preview recent?</DialogTitle>
            <DialogDescription>
              No has fet un Preview en els últims 10 minuts. Run Now
              publicarà el missatge al canal de Slack i no es pot
              desfer. Vols continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewWarnOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onPreviewConfirm}>
              Continua i dispara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

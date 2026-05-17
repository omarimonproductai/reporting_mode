"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDryRun } from "@/hooks/useDryRun";
import { briefSchema, type Brief } from "@/lib/schemas";

type Props =
  | {
      mode: "persisted";
      brief: Brief;
      filename?: string;
      size?: "sm" | "default";
    }
  | {
      mode: "form";
      getBrief: () => Brief;
      // Form validity as known by RHF. When false the button stays
      // visible but disabled with a Tooltip — meets the smoke-test
      // feedback «Preview shouldn't appear by magic»; it's always
      // there, just inert until prerequisites are met.
      disabled?: boolean;
      filename?: string;
      size?: "sm" | "default";
    };

export function DryRunButton(props: Props) {
  const { run } = useDryRun();
  const size = props.size ?? "sm";

  function onClick() {
    const brief = props.mode === "persisted" ? props.brief : props.getBrief();
    const parsed = briefSchema.safeParse(brief);
    if (!parsed.success) {
      // Should be prevented by the disabled-state predicate, but
      // defensive — never dispatch an invalid payload.
      return;
    }
    run(parsed.data, { filename: props.filename });
  }

  // Disabled state: in "persisted" mode we know up-front via
  // safeParse; in "form" mode we trust the caller's `disabled` prop
  // (typically RHF's !isValid). Either way the button stays mounted
  // — no «appears by magic» surprise.
  const formDisabled = props.mode === "form" && props.disabled === true;
  const persistedDisabled =
    props.mode === "persisted" && !briefSchema.safeParse(props.brief).success;
  const isDisabled = formDisabled || persistedDisabled;

  if (isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button type="button" variant="outline" size={size} disabled>
              <Sparkles />
              Preview output
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Omple els camps obligatoris abans de fer preview.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={onClick}>
      <Sparkles />
      Preview output
    </Button>
  );
}

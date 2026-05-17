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
  | { mode: "persisted"; brief: Brief; size?: "sm" | "default" }
  | { mode: "form"; getBrief: () => Brief; size?: "sm" | "default" };

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
    run(parsed.data);
  }

  // For the "persisted" mode we can validate at render time. For
  // "form" we don't know the latest values until click, so the
  // disabled gating only applies to the persisted path.
  if (props.mode === "persisted") {
    const valid = briefSchema.safeParse(props.brief).success;
    if (!valid) {
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
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={onClick}>
      <Sparkles />
      Preview output
    </Button>
  );
}

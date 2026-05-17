"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  reportToken: string;
  queryToken: string;
  onClick: (reportToken: string, queryToken: string) => void;
};

export function PreviewButton({ reportToken, queryToken, onClick }: Props) {
  const disabled = !reportToken.trim() || !queryToken.trim();

  if (disabled) {
    // Wrap the disabled button in a span so the Tooltip receives the
    // hover event — Radix Tooltip doesn't fire on a child whose
    // pointer-events: none is set (which `disabled` implies).
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button type="button" variant="ghost" size="sm" disabled>
              <Eye />
              Preview data
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          Selecciona report i query abans de fer preview.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onClick(reportToken, queryToken)}
    >
      <Eye />
      Preview data
    </Button>
  );
}

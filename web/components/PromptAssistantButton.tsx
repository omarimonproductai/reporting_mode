"use client";

import { Bot } from "lucide-react";
import { BetaChip } from "@/components/BetaChip";
import { Button } from "@/components/ui/button";

type Props = {
  onClick: () => void;
};

export function PromptAssistantButton({ onClick }: Props) {
  return (
    <Button type="button" variant="outline" size="xs" onClick={onClick}>
      <Bot />
      Prompt Assistant
      <BetaChip className="ml-0.5" />
    </Button>
  );
}

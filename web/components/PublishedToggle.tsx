"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
};

export function PublishedToggle({
  value,
  onChange,
  disabled = false,
  id = "published-toggle",
}: Props) {
  return (
    <div className="flex h-9 items-center gap-2">
      <Switch
        id={id}
        size="sm"
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      <Label
        htmlFor={id}
        className={cn(
          "select-none text-xs font-medium",
          value ? "text-zinc-700" : "text-zinc-500"
        )}
      >
        {value ? "Published" : "Draft"}
      </Label>
    </div>
  );
}

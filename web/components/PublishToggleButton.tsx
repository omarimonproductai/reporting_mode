"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CircleOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  filename: string;
  published: boolean;
  // When true, render the menu-item layout (full-width, left-aligned,
  // borderless) so it can drop into the sidebar kebab Popover. When
  // false (default), render as a header-bar Button.
  variant?: "button" | "menu-item";
  onAfterChange?: () => void;
};

export function PublishToggleButton({
  filename,
  published,
  variant = "button",
  onAfterChange,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy || isPending) return;
    const next = !published;
    setBusy(true);
    try {
      const res = await fetch(`/api/briefs/${filename}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(body.error ?? "No s'ha pogut canviar l'estat");
        return;
      }
      toast.success(next ? "Brief publicat" : "Brief en draft");
      startTransition(() => {
        router.refresh();
      });
      onAfterChange?.();
    } finally {
      setBusy(false);
    }
  }

  const label = published ? "Unpublish" : "Publish";
  const Icon = busy || isPending ? Loader2 : published ? CircleOff : CheckCircle2;

  if (variant === "menu-item") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy || isPending}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:bg-transparent"
      >
        <Icon
          className={
            busy || isPending
              ? "size-4 animate-spin text-zinc-500"
              : "size-4 text-zinc-500"
          }
        />
        {label}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggle}
      disabled={busy || isPending}
    >
      <Icon className={busy || isPending ? "animate-spin" : ""} />
      {label}
    </Button>
  );
}

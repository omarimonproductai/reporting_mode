import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function DraftChip({ className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-zinc-200 bg-zinc-100 px-1 py-px font-mono text-[10px] uppercase tracking-wide text-zinc-500",
        className
      )}
    >
      Draft
    </span>
  );
}

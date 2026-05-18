import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function BetaChip({ className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-amber-200 bg-amber-50 px-1 py-px font-mono text-[10px] uppercase tracking-wide text-amber-700",
        className
      )}
    >
      Beta
    </span>
  );
}

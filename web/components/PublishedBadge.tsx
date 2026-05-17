import { cn } from "@/lib/utils";

type Props = {
  published: boolean;
  className?: string;
};

export function PublishedBadge({ published, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        published
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border border-zinc-200 bg-zinc-100 text-zinc-600",
        className
      )}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

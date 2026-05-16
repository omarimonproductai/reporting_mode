import { Skeleton } from "@/components/ui/skeleton";

export function BriefFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div>
        <Skeleton className="mb-1.5 h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <Skeleton className="h-3 w-16" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <Skeleton className="h-3 w-24" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      </section>
    </div>
  );
}

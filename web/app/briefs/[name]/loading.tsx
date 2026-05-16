import { BriefFormSkeleton } from "@/components/BriefFormSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BriefDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />

      <div className="mt-6">
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="ml-auto size-7 rounded-md" />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <BriefFormSkeleton />
      </div>
    </div>
  );
}

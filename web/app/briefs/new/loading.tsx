import { BriefFormSkeleton } from "@/components/BriefFormSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewBriefLoading() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-8">
        <BriefFormSkeleton />
      </div>
    </div>
  );
}

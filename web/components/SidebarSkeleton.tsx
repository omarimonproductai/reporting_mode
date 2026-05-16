import { Skeleton } from "@/components/ui/skeleton";

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-7 w-full" />
      <ul className="mt-2 flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-1 px-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <Skeleton className="ml-3.5 h-3 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}

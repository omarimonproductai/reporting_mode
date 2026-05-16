import Link from "next/link";
import { Plus } from "lucide-react";
import { BriefSidebarList } from "@/components/BriefSidebarList";
import { Button } from "@/components/ui/button";
import { getBriefListWithRuns, type BriefListItemWithRun } from "@/lib/briefs";

export async function BriefSidebar() {
  let briefs: BriefListItemWithRun[] = [];
  let errorMessage: string | null = null;
  try {
    briefs = await getBriefListWithRuns();
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <Button asChild size="sm" className="w-full justify-start">
        <Link href="/briefs/new">
          <Plus />
          New brief
        </Link>
      </Button>

      {errorMessage ? (
        <div className="px-2 text-xs text-red-600">
          No s&apos;han pogut carregar els briefs: {errorMessage}
        </div>
      ) : (
        <BriefSidebarList briefs={briefs} />
      )}
    </div>
  );
}

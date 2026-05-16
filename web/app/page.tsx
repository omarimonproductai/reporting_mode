import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBriefList } from "@/lib/briefs";

export const dynamic = "force-dynamic";

export default async function Home() {
  let briefCount = 0;
  let listError = false;
  try {
    const briefs = await getBriefList();
    briefCount = briefs.length;
  } catch {
    listError = true;
  }

  if (briefCount === 0 && !listError) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="max-w-md rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-8 py-12 text-center">
          <FileText className="mx-auto size-8 text-zinc-400" />
          <h2 className="mt-3 text-sm font-medium text-zinc-900">
            Cap brief encara
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Crea&apos;n el primer.</p>
          <Button asChild size="sm" className="mt-5">
            <Link href="/briefs/new">
              <Plus />
              New brief
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Cooltra Reporting Platform
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          La llista de briefs apareixerà a la barra lateral.
        </p>
      </div>
    </div>
  );
}

import { BriefForm } from "@/components/BriefForm";
import { RunNowButton } from "@/components/RunNowButton";

type Props = {
  searchParams: Promise<{ prefill_report?: string }>;
};

export default async function NewBriefPage({ searchParams }: Props) {
  const { prefill_report } = await searchParams;
  const prefillReport = prefill_report?.trim() ?? "";

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-zinc-900">New brief</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Omple els camps; el nom del fitxer es derivarà del camp Name.
          </p>
        </div>
        <div className="shrink-0">
          <RunNowButton mode="create" />
        </div>
      </div>
      <div className="mt-8">
        <BriefForm
          intent="create"
          prefillReportToken={prefillReport || undefined}
        />
      </div>
    </div>
  );
}

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
      <h1 className="text-2xl font-semibold text-zinc-900">New brief</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Omple els camps; el nom del fitxer es derivarà del camp Name.
      </p>

      <div className="mt-8">
        <BriefForm
          intent="create"
          prefillReportToken={prefillReport || undefined}
          briefActions={<RunNowButton mode="create" />}
        />
      </div>
    </div>
  );
}

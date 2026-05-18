import { notFound } from "next/navigation";
import { BriefForm } from "@/components/BriefForm";
import { DryRunButton } from "@/components/DryRunButton";
import { ExecutionMetadata } from "@/components/ExecutionMetadata";
import { HistoryDrawerButton } from "@/components/HistoryDrawerButton";
import { PublishToggleButton } from "@/components/PublishToggleButton";
import { RunNowButton } from "@/components/RunNowButton";
import { BriefNotFoundError, readBrief } from "@/lib/github";
import { parseBrief } from "@/lib/yaml";

type Params = {
  params: Promise<{ name: string }>;
  // Query-string flags written by the sidebar kebab (BriefRowMenu) to
  // pre-activate Edit mode or auto-open the History drawer. Defined here
  // so the page knows about both entry vectors (direct click on the row
  // → no params; click on Edit/History from the kebab → params present).
  searchParams: Promise<{ edit?: string; history?: string }>;
};

export const dynamic = "force-dynamic";

export default async function BriefDetailPage({ params, searchParams }: Params) {
  const { name } = await params;
  const sp = await searchParams;
  const initialEdit = sp.edit === "1";
  const initialHistory = sp.history === "1";

  let brief;
  let sha;
  try {
    const blob = await readBrief(name);
    brief = parseBrief(blob.content);
    sha = blob.sha;
  } catch (err) {
    if (err instanceof BriefNotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <BriefForm
        filename={name}
        initialBrief={brief}
        initialSha={sha}
        initialMode={initialEdit ? "edit" : "view"}
        metadataSlot={<ExecutionMetadata filename={name} />}
        briefActions={
          <>
            <PublishToggleButton
              filename={name}
              published={brief.published}
            />
            <DryRunButton
              mode="persisted"
              brief={brief}
              filename={name}
            />
            <RunNowButton
              mode="existing"
              filename={name}
              published={brief.published}
              briefName={brief.name}
            />
            <HistoryDrawerButton
              filename={name}
              briefName={brief.name}
              slackChannel={brief.slack_channel}
              initialOpen={initialHistory}
            />
          </>
        }
      />
    </div>
  );
}

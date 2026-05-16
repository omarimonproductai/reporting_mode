import { notFound } from "next/navigation";
import { BriefForm } from "@/components/BriefForm";
import { EarlyDataWarning } from "@/components/EarlyDataWarning";
import { ExecutionMetadata } from "@/components/ExecutionMetadata";
import { BriefNotFoundError, readBrief } from "@/lib/github";
import { parseBrief } from "@/lib/yaml";

type Params = { params: Promise<{ name: string }> };

export const dynamic = "force-dynamic";

export default async function BriefDetailPage({ params }: Params) {
  const { name } = await params;

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
      <h1 className="text-2xl font-semibold text-zinc-900">{brief.name}</h1>
      <p className="mt-1 text-sm text-zinc-500 font-mono">{name}.yml</p>

      <div className="mt-6">
        <EarlyDataWarning />
      </div>

      <div className="mt-4">
        <ExecutionMetadata filename={name} />
      </div>

      <div className="mt-8">
        <BriefForm
          filename={name}
          initialBrief={brief}
          initialSha={sha}
          loadedAt={new Date().toISOString()}
        />
      </div>
    </div>
  );
}

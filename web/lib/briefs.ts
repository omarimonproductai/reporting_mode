import "server-only";
import { listBriefs, readBrief } from "@/lib/github";
import { fetchLatestRuns, type RunLookup } from "@/lib/runs";
import type { BriefListItem } from "@/lib/schemas";
import { parseBrief } from "@/lib/yaml";

export async function getBriefList(): Promise<BriefListItem[]> {
  const files = await listBriefs();
  const items = await Promise.all(
    files.map(async (file): Promise<BriefListItem | null> => {
      try {
        const blob = await readBrief(file.filename);
        const brief = parseBrief(blob.content);
        return {
          filename: file.filename,
          name: brief.name,
          published: brief.published,
          schedule: brief.schedule,
          slack_channel: brief.slack_channel,
          source_count: brief.sources.length,
          query_count: brief.sources.reduce(
            (acc, src) => acc + src.queries.length,
            0
          ),
          sha: blob.sha,
        };
      } catch (err) {
        console.error(`Failed to parse brief ${file.filename}:`, err);
        return null;
      }
    })
  );
  const briefs = items.filter((item): item is BriefListItem => item !== null);
  briefs.sort((a, b) => a.name.localeCompare(b.name, "ca"));
  return briefs;
}

export type BriefListItemWithRun = BriefListItem & { run: RunLookup };

export async function getBriefListWithRuns(): Promise<BriefListItemWithRun[]> {
  const briefs = await getBriefList();
  let runs: Map<string, RunLookup>;
  try {
    runs = await fetchLatestRuns(briefs.map((b) => b.filename));
  } catch (err) {
    console.error("Failed to fetch latest runs for sidebar:", err);
    runs = new Map();
  }
  return briefs.map((b) => ({
    ...b,
    run: runs.get(b.filename) ?? { kind: "never-run" },
  }));
}

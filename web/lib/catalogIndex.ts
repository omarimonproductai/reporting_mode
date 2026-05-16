import "server-only";

import { listBriefs, readBrief } from "@/lib/github";
import type { BriefListItem } from "@/lib/schemas";
import { parseBrief } from "@/lib/yaml";

/**
 * Index every brief in the repo by the Mode query tokens it references.
 *
 * Walks `briefs/*.yml` once via the existing listBriefs + parseBrief
 * pipeline (the same one the sidebar uses) and inverts each brief's
 * `sources[].queries[].token` into a map. Used by the Mode catalog
 * landing to render a «usat per N briefs» badge per query and
 * inline-expand the list of consuming briefs on click.
 *
 * Cooltra-scale (≤ 30 briefs × ≤ 5 queries each) means this is
 * trivially fast. If the data set grows we can memoise across
 * requests (the calling endpoint already caches for 5 min).
 */
export async function buildCatalogUsageIndex(): Promise<
  Map<string, BriefListItem[]>
> {
  const files = await listBriefs();
  const briefs = await Promise.all(
    files.map(async (file) => {
      try {
        const blob = await readBrief(file.filename);
        const parsed = parseBrief(blob.content);
        const item: BriefListItem = {
          filename: file.filename,
          name: parsed.name,
          schedule: parsed.schedule,
          slack_channel: parsed.slack_channel,
          source_count: parsed.sources.length,
          query_count: parsed.sources.reduce(
            (acc, src) => acc + src.queries.length,
            0
          ),
          sha: blob.sha,
        };
        const tokens = new Set<string>();
        for (const source of parsed.sources) {
          for (const query of source.queries) {
            const t = query.token.trim();
            if (t) tokens.add(t);
          }
        }
        return { item, tokens };
      } catch (err) {
        console.error(
          `catalogIndex: failed to parse ${file.filename}:`,
          err
        );
        return null;
      }
    })
  );

  const index = new Map<string, BriefListItem[]>();
  for (const entry of briefs) {
    if (!entry) continue;
    for (const token of entry.tokens) {
      const existing = index.get(token);
      if (existing) existing.push(entry.item);
      else index.set(token, [entry.item]);
    }
  }
  // Sort consumers alphabetically within each token so the UI list is
  // deterministic across renders.
  for (const list of index.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "ca"));
  }
  return index;
}

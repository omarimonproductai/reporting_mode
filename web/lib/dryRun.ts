import "server-only";

import {
  getQueryRunResults,
  getReportMetadata,
  listQueryRunsForRun,
  triggerReport,
  waitForCompletion,
} from "@/lib/mode";
import type { Brief } from "@/lib/schemas";
import { streamChatCompletion, type TokenUsage } from "@/lib/groq";

export type DryRunEvent =
  | { kind: "mode-fetched" }
  | { kind: "groq-chunk"; delta: string }
  | { kind: "complete"; usage: TokenUsage }
  | { kind: "error"; phase: "mode" | "groq"; message: string };

type QueryResult = {
  reportTitle: string;
  queryName: string;
  rows: Record<string, unknown>[];
};

/**
 * Run the full Mode → GROQ pipeline against the given brief (in-memory
 * payload, may be unsaved). Yields lifecycle events as it progresses.
 *
 * Does NOT write `.run.json`, `.brief.md`, post to Slack, or commit
 * to GitHub — this is the strictly-ephemeral path. The production
 * executor (`scripts/executor.py`) remains the canonical implementation
 * for any path that needs side-effects.
 */
export async function* runDryRun(
  brief: Brief,
  signal: AbortSignal
): AsyncGenerator<DryRunEvent> {
  // === Mode phase ===
  let results: QueryResult[];
  try {
    results = await fetchAllSources(brief, signal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Mode error";
    yield { kind: "error", phase: "mode", message };
    return;
  }
  yield { kind: "mode-fetched" };

  // === GROQ phase ===
  const userMessage = buildUserMessage(results);
  try {
    let lastUsage: TokenUsage = { input: 0, output: 0, total: 0 };
    for await (const chunk of streamChatCompletion({
      systemPrompt: brief.prompt,
      userMessage,
      signal,
    })) {
      if (chunk.kind === "delta") {
        yield { kind: "groq-chunk", delta: chunk.delta };
      } else {
        lastUsage = chunk.usage;
      }
    }
    yield { kind: "complete", usage: lastUsage };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // Caller-initiated cancellation — no event to yield, the
      // route handler closes the SSE stream cleanly.
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown GROQ error";
    yield { kind: "error", phase: "groq", message };
  }
}

async function fetchAllSources(
  brief: Brief,
  signal: AbortSignal
): Promise<QueryResult[]> {
  const collected: QueryResult[] = [];
  for (const source of brief.sources) {
    if (signal.aborted) {
      throw new Error("Dry-run aborted by caller");
    }
    const reportToken = source.mode_report_token;
    const meta = await getReportMetadata(reportToken);
    const runToken = await triggerReport(reportToken);
    await waitForCompletion(reportToken, runToken, { signal });
    const queryRuns = await listQueryRunsForRun(reportToken, runToken);

    for (const requested of source.queries) {
      const qr =
        queryRuns.find((q) => q.query_token === requested.token) ??
        queryRuns.find((q) => q.query_name === requested.token);
      if (!qr) {
        throw new Error(
          `Query token ${requested.token} not found in run ${runToken} of report ${reportToken}`
        );
      }
      const rows = await getQueryRunResults(reportToken, runToken, qr.token);
      collected.push({
        reportTitle: meta.name,
        queryName: qr.query_name,
        rows,
      });
    }
  }
  return collected;
}

/**
 * Same shape as `executor.py:build_user_message`. Compact-JSON serialisation
 * to keep the token count low — modern LLMs parse compact JSON identically
 * to indented JSON.
 */
function buildUserMessage(results: QueryResult[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const parts: string[] = [`Today's date: ${today}`, ""];
  for (const result of results) {
    parts.push(
      `## Query: "${result.queryName}" (from report "${result.reportTitle}")`
    );
    parts.push("```json");
    parts.push(JSON.stringify(result.rows));
    parts.push("```");
    parts.push("");
  }
  return parts.join("\n");
}

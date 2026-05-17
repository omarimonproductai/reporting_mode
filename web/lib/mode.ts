import "server-only";

import type {
  LatestRunLookup,
  ModeQuery,
  ModeQueryRun,
  ModeReport,
  ModeRun,
} from "@/lib/mode-types";

export type {
  LatestRunLookup,
  ModeQuery,
  ModeQueryRun,
  ModeReport,
  ModeRun,
};

const MODE_BASE_URL = "https://app.mode.com/api";

// Poll cadence + ceiling for `waitForCompletion`. Mode runs typically
// finish in 5-15 s; 120 s is the safe-but-not-runaway ceiling
// (matches `scripts/executor.py:POLL_TIMEOUT_SECONDS`).
const POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_DEADLINE_MS = 120_000;
const SUCCESS_STATES = new Set(["completed", "succeeded"]);
const IN_PROGRESS_STATES = new Set([
  "enqueued",
  "pending",
  "running",
  "cancelling",
]);

function getConfig() {
  const token = process.env.MODE_TOKEN;
  const secret = process.env.MODE_SECRET;
  const account = process.env.DEFAULT_MODE_ACCOUNT;
  const space = process.env.MODE_SPACE;
  if (!token || !secret || !account || !space) {
    throw new Error(
      "MODE_TOKEN, MODE_SECRET, DEFAULT_MODE_ACCOUNT and MODE_SPACE must be set"
    );
  }
  return { token, secret, account, space };
}

function authHeader(token: string, secret: string): string {
  // Mode API uses HTTP Basic auth with the token as user and the secret as
  // password. Same shape the Python executor (scripts/executor.py) uses via
  // requests' `auth=(token, secret)` tuple.
  const credentials = Buffer.from(`${token}:${secret}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * List the reports inside a Mode space. The Mode API returns the payload
 * under `_embedded.reports` with token/name plus a lot of metadata we
 * discard here.
 */
export async function listSpaceReports(): Promise<ModeReport[]> {
  const { token, secret, account, space } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/spaces/${space}/reports`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listSpaceReports failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: { reports?: { token: string; name: string }[] };
  };
  const reports = data._embedded?.reports ?? [];
  return reports.map((r) => ({ token: r.token, name: r.name }));
}

/**
 * List the queries that belong to a Mode report. Mirrors the Python
 * executor's `get_queries(...)` flow.
 */
export async function listReportQueries(
  reportToken: string
): Promise<ModeQuery[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/queries`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listReportQueries(${reportToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: { queries?: { token: string; name: string }[] };
  };
  const queries = data._embedded?.queries ?? [];
  return queries.map((q) => ({ token: q.token, name: q.name }));
}

/**
 * Fetch a Mode report's metadata. The dry-run pipeline (task 18.0)
 * uses the human-readable `name` to inject into the user_message
 * block as `## Query: "..." (from report "<title>")`.
 */
export async function getReportMetadata(
  reportToken: string
): Promise<{ name: string }> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode getReportMetadata(${reportToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as { name?: string };
  return { name: data.name ?? reportToken };
}

/**
 * Trigger a fresh run of a Mode report. Mirrors
 * `executor.py:trigger_report`. Returns the new run's token; the
 * caller polls it via `waitForCompletion` until success / failure /
 * timeout.
 *
 * Used by the dry-run endpoint (task 18.0) to fetch fresh data —
 * deliberately different from the preview path (task 17.0) which
 * reuses the latest succeeded run instead of triggering.
 */
export async function triggerReport(reportToken: string): Promise<string> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs`,
    {
      method: "POST",
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode triggerReport(${reportToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error(
      `Mode triggerReport(${reportToken}) returned no run token`
    );
  }
  return data.token;
}

/**
 * Poll a Mode run until it reaches a terminal state. Throws on
 * failure / timeout / abort. Mirrors `executor.py:wait_for_completion`
 * with the additional `signal` integration so the dry-run cancel
 * path tears down cleanly.
 */
export async function waitForCompletion(
  reportToken: string,
  runToken: string,
  opts: { signal?: AbortSignal; deadlineMs?: number } = {}
): Promise<void> {
  const { token, secret, account } = getConfig();
  const deadline = Date.now() + (opts.deadlineMs ?? DEFAULT_POLL_DEADLINE_MS);

  while (true) {
    if (opts.signal?.aborted) {
      throw new Error("Mode waitForCompletion aborted by caller");
    }
    const res = await fetch(
      `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs/${runToken}`,
      {
        headers: {
          Accept: "application/hal+json",
          Authorization: authHeader(token, secret),
        },
        cache: "no-store",
        signal: opts.signal,
      }
    );
    if (!res.ok) {
      throw new Error(
        `Mode waitForCompletion(${reportToken}, ${runToken}) failed: ${res.status} ${await res.text()}`
      );
    }
    const data = (await res.json()) as { state?: string };
    const state = data.state ?? "unknown";
    if (SUCCESS_STATES.has(state)) return;
    if (!IN_PROGRESS_STATES.has(state)) {
      throw new Error(
        `Mode waitForCompletion(${reportToken}, ${runToken}) terminal non-success state: ${state}`
      );
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Mode waitForCompletion(${reportToken}, ${runToken}) timed out after ${opts.deadlineMs ?? DEFAULT_POLL_DEADLINE_MS}ms`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * List the historical runs of a Mode report, sorted descending by
 * completion time. Returns the raw `_embedded.runs[]` projected to the
 * fields the preview endpoint (task 17.0) consumes: token, state,
 * created_at, completed_at.
 *
 * Mode's docs call the API ordering "approximately descending"; we
 * sort defensively after the fetch so callers don't have to.
 */
export async function listReportRuns(
  reportToken: string
): Promise<ModeRun[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listReportRuns(${reportToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: {
      report_runs?: {
        token: string;
        state: string;
        created_at: string;
        completed_at: string | null;
      }[];
    };
  };
  const raw = data._embedded?.report_runs ?? [];
  const runs: ModeRun[] = raw.map((r) => ({
    token: r.token,
    state: r.state,
    created_at: r.created_at,
    completed_at: r.completed_at,
  }));
  runs.sort((a, b) => {
    const ax = a.completed_at ?? a.created_at;
    const bx = b.completed_at ?? b.created_at;
    return bx.localeCompare(ax); // ISO timestamps sort lexicographically
  });
  return runs;
}

/**
 * Find the latest run of a Mode report whose `state === "succeeded"`,
 * plus a bonus `anyRun` field surfacing the chronologically-latest run
 * regardless of state. The preview endpoint uses both signals to
 * distinguish «no previous run» from «latest run failed»:
 *   - latest === null && anyRun === null → kind: "no-previous-run"
 *   - latest === null && anyRun !== null → kind: "run-failed"
 *   - latest !== null                    → kind: "ready" (continue)
 */
export async function findLatestSucceededRun(
  reportToken: string
): Promise<LatestRunLookup> {
  const runs = await listReportRuns(reportToken);
  if (runs.length === 0) {
    return { latest: null, anyRun: null };
  }
  const latest = runs.find((r) => r.state === "succeeded") ?? null;
  return { latest, anyRun: runs[0] };
}

/**
 * List the query runs that ran as part of a specific report run.
 * Mirrors the Python executor's `list_query_runs(...)` flow.
 *
 * Returns BOTH `token` (per-run query_run identifier; plugs into the
 * results URL) and `query_token` (stable query identifier; matches
 * the token the BriefForm carries). Older Mode tenants may omit
 * `query_token`; the caller falls back to matching by `query_name`.
 */
export async function listQueryRunsForRun(
  reportToken: string,
  runToken: string
): Promise<ModeQueryRun[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs/${runToken}/query_runs`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listQueryRunsForRun(${reportToken}, ${runToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: {
      query_runs?: {
        token: string;
        query_token?: string;
        query_name: string;
        state: string;
      }[];
    };
  };
  const raw = data._embedded?.query_runs ?? [];
  return raw.map((q) => ({
    token: q.token,
    query_token: q.query_token,
    query_name: q.query_name,
    state: q.state,
  }));
}

/**
 * Fetch the row payload of a specific query run. Mirrors the Python
 * executor's `get_query_results(...)` flow — same JSON `content.json`
 * resource. Returns an array of row objects; Mode caps the response
 * at ~1000 rows. Consumers slice to whatever cap they need after the
 * fetch — Mode does not expose a server-side limit param.
 */
export async function getQueryRunResults(
  reportToken: string,
  runToken: string,
  queryRunToken: string
): Promise<Record<string, unknown>[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs/${runToken}/query_runs/${queryRunToken}/results/content.json`,
    {
      headers: {
        Accept: "application/json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode getQueryRunResults(${reportToken}, ${runToken}, ${queryRunToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  return (await res.json()) as Record<string, unknown>[];
}

import "server-only";

import type { ModeQuery, ModeReport } from "@/lib/mode-types";

export type { ModeQuery, ModeReport };

const MODE_BASE_URL = "https://app.mode.com/api";

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

import "server-only";
import JSZip from "jszip";

export type RunRecord = {
  brief: string;
  started_at: string;
  finished_at: string | null;
  status: "success" | "failed";
  tokens: { input: number; output: number; total: number } | null;
  error: string | null;
};

export type RunLookup =
  | {
      kind: "ready";
      record: RunRecord;
      artifact_name: string;
      artifact_created_at: string;
    }
  | { kind: "never-run" };

type Artifact = {
  id: number;
  name: string;
  created_at: string;
  expired: boolean;
};

const GITHUB_API = "https://api.github.com";

function getConfig() {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    throw new Error(
      "GITHUB_REPO_OWNER, GITHUB_REPO_NAME and GITHUB_TOKEN must be set"
    );
  }
  return { owner, repo, token };
}

async function listArtifacts(): Promise<Artifact[]> {
  const { owner, repo, token } = getConfig();
  // First page only (max 100). Most-recent-first sort means the latest
  // run.json for any brief is almost certainly within the first page.
  // Pagination can be added later if needed.
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/artifacts?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `GitHub artifacts list failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as { artifacts: Artifact[] };
  return data.artifacts;
}

async function downloadZip(artifact: Artifact): Promise<JSZip | null> {
  const { owner, repo, token } = getConfig();
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/artifacts/${artifact.id}/zip`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
      redirect: "follow",
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return JSZip.loadAsync(buf);
}

function artifactCouldContainSlug(name: string, slug: string): boolean {
  return name.startsWith(`run-${slug}-`) || name.startsWith("runs-due-");
}

/**
 * Resolve the latest RunRecord for each requested slug, sharing a single
 * artifact listing and (where possible) the same downloaded ZIP across
 * multiple slugs that fired together.
 */
export async function fetchLatestRuns(
  slugs: string[]
): Promise<Map<string, RunLookup>> {
  const result = new Map<string, RunLookup>();
  for (const slug of slugs) result.set(slug, { kind: "never-run" });
  if (slugs.length === 0) return result;

  const artifacts = await listArtifacts();
  const candidates = artifacts
    .filter(
      (a) =>
        !a.expired &&
        (a.name.startsWith("run-") || a.name.startsWith("runs-due-"))
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const remaining = new Set(slugs);

  for (const artifact of candidates) {
    if (remaining.size === 0) break;
    const relevant = [...remaining].filter((s) =>
      artifactCouldContainSlug(artifact.name, s)
    );
    if (relevant.length === 0) continue;

    let zip: JSZip | null;
    try {
      zip = await downloadZip(artifact);
    } catch (err) {
      console.error(`Failed to download artifact ${artifact.id}:`, err);
      continue;
    }
    if (!zip) continue;

    for (const slug of relevant) {
      const entry = zip.file(`${slug}.run.json`);
      if (!entry) continue;
      try {
        const content = await entry.async("string");
        const record = JSON.parse(content) as RunRecord;
        result.set(slug, {
          kind: "ready",
          record,
          artifact_name: artifact.name,
          artifact_created_at: artifact.created_at,
        });
        remaining.delete(slug);
      } catch (err) {
        console.error(
          `Failed to parse ${slug}.run.json inside ${artifact.name}:`,
          err
        );
      }
    }
  }

  return result;
}

export async function fetchLatestRun(slug: string): Promise<RunLookup> {
  const map = await fetchLatestRuns([slug]);
  return map.get(slug) ?? { kind: "never-run" };
}

export type LatestCommit = {
  sha: string;
  authoredAt: string;
};

export async function getLatestCommit(): Promise<LatestCommit> {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo) {
    throw new Error(
      "GITHUB_REPO_OWNER and GITHUB_REPO_NAME must be set"
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/main`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    throw new Error(
      `GitHub commits API returned ${res.status}: ${await res.text()}`
    );
  }

  const data = (await res.json()) as {
    sha: string;
    commit: { message: string; author: { date: string } };
  };

  return {
    sha: data.sha,
    authoredAt: data.commit.author.date,
  };
}

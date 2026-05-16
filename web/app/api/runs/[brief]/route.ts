import { NextResponse } from "next/server";
import { fetchLatestRun, type RunLookup } from "@/lib/runs";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  fetchedAt: number;
  data: RunLookup;
};

const cache = new Map<string, CacheEntry>();

type Params = { params: Promise<{ brief: string }> };

export async function GET(
  request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { brief: slug } = await params;
  const force = new URL(request.url).searchParams.get("force") === "true";
  const now = Date.now();

  const cached = cache.get(slug);
  if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      fetched_at: cached.fetchedAt,
    });
  }

  try {
    const data = await fetchLatestRun(slug);
    cache.set(slug, { fetchedAt: now, data });
    return NextResponse.json({ ...data, cached: false, fetched_at: now });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { dispatchBriefRun } from "@/lib/dispatch";
import { listBriefs, readBrief } from "@/lib/github";
import { isDue } from "@/lib/scheduler";
import { parseBrief } from "@/lib/yaml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Failure = { brief: string; message: string };

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — guard explicitly to keep the
  // 401 path constant-time regardless of how wrong the caller's header is.
  if (headerBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(headerBuf, expectedBuf);
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorize(request)) {
    return new NextResponse(null, { status: 401 });
  }

  const start = Date.now();
  const now = new Date();

  let files;
  try {
    files = await listBriefs();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      JSON.stringify({ event: "scheduler.tick.list_error", message })
    );
    return NextResponse.json(
      { error: "Failed to list briefs", message },
      { status: 502 }
    );
  }

  const due: string[] = [];
  let skipped_draft = 0;
  for (const file of files) {
    try {
      const blob = await readBrief(file.filename);
      const brief = parseBrief(blob.content);
      // Draft briefs are intentionally excluded from auto-dispatch. The
      // `!== false` shape mirrors parseBrief's default-true tolerance —
      // a brief without an explicit `published` boolean still reads as
      // published (defensive against a never-migrated YAML slipping
      // through).
      if (brief.published === false) {
        skipped_draft++;
        continue;
      }
      if (isDue(brief.schedule, now)) {
        due.push(file.filename);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn(
        JSON.stringify({
          event: "scheduler.tick.read_error",
          brief: file.filename,
          message,
        })
      );
    }
  }

  const dispatched: string[] = [];
  const failures: Failure[] = [];
  for (const filename of due) {
    const result = await dispatchBriefRun(filename);
    if (result.status === "ok") {
      dispatched.push(filename);
    } else {
      failures.push({ brief: filename, message: result.message });
    }
  }

  const took_ms = Date.now() - start;
  console.log(
    JSON.stringify({
      event: "scheduler.tick",
      scanned: files.length,
      skipped_draft,
      due: due.length,
      dispatched: dispatched.length,
      failures: failures.length,
      took_ms,
    })
  );

  return NextResponse.json({
    scanned: files.length,
    skipped_draft,
    due,
    dispatched,
    failures,
  });
}

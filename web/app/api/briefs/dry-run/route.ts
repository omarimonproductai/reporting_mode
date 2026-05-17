import "server-only";

import { NextResponse } from "next/server";

import { runDryRun, type DryRunEvent } from "@/lib/dryRun";
import { briefSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseLine(event: DryRunEvent): string {
  return `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = briefSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid brief payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const brief = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runDryRun(brief, request.signal)) {
          controller.enqueue(encoder.encode(sseLine(event)));
        }
      } catch (err) {
        // Last-resort safety net: a thrown error inside the generator
        // (above and beyond the per-phase try/catch in dryRun.ts)
        // surfaces as a final SSE error event so the client always
        // sees a well-formed terminator.
        const message =
          err instanceof Error ? err.message : "Unexpected dry-run failure";
        controller.enqueue(
          encoder.encode(
            sseLine({ kind: "error", phase: "groq", message })
          )
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Reader cancellation surfaces here. The runDryRun generator
      // already aborts via request.signal when the client disconnects;
      // nothing extra to do.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Disable nginx-style proxy buffering — chunks must flush
      // immediately to the client so streaming feels live.
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

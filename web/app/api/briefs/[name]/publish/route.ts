import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  BriefNotFoundError,
  readBrief,
  writeBrief,
} from "@/lib/github";
import { parseBrief, serializeBrief } from "@/lib/yaml";

type Params = { params: Promise<{ name: string }> };

/**
 * Toggle the brief's `published` flag without going through the full
 * edit-form flow. Used by the detail-page header button and the
 * sidebar kebab «Publish»/«Unpublish» entries — publish/unpublish is
 * an OPERATIONAL ACTION, not a configuration value, so it makes more
 * sense as a one-click button than as a form field.
 *
 * Body: `{ published: boolean }`.
 */
export async function PATCH(
  request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { name } = await params;

  let payload;
  try {
    payload = (await request.json()) as { published?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (typeof payload.published !== "boolean") {
    return NextResponse.json(
      { error: "Missing or invalid `published` (must be boolean)" },
      { status: 400 }
    );
  }

  try {
    const blob = await readBrief(name);
    const brief = parseBrief(blob.content);
    if (brief.published === payload.published) {
      // No-op — return current sha so the client can move on.
      return NextResponse.json({
        sha: blob.sha,
        published: brief.published,
      });
    }
    const updated = { ...brief, published: payload.published };
    const content = serializeBrief(updated);
    const result = await writeBrief(name, content, blob.sha);
    revalidatePath("/", "layout");
    return NextResponse.json({
      sha: result.sha,
      published: payload.published,
    });
  } catch (err) {
    if (err instanceof BriefNotFoundError) {
      return NextResponse.json(
        { error: "Brief not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

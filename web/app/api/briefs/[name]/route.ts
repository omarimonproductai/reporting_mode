import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getBriefList } from "@/lib/briefs";
import {
  BriefNotFoundError,
  deleteBrief,
  readBrief,
  writeBrief,
} from "@/lib/github";
import { briefSchema } from "@/lib/schemas";
import { parseBrief, serializeBrief } from "@/lib/yaml";

type Params = { params: Promise<{ name: string }> };

export async function GET(
  _request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { name } = await params;
  try {
    const blob = await readBrief(name);
    const brief = parseBrief(blob.content);
    return NextResponse.json({ brief, sha: blob.sha });
  } catch (err) {
    if (err instanceof BriefNotFoundError) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(
  request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { name } = await params;
  let payload;
  try {
    payload = (await request.json()) as { brief?: unknown; sha?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof payload.sha !== "string" || !payload.sha) {
    return NextResponse.json(
      { error: "Missing sha (last known commit sha for this file)" },
      { status: 400 }
    );
  }

  const parsed = briefSchema.safeParse(payload.brief);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid brief payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Reject renaming this brief to a `name` that another brief
  // already uses. The filename never changes on edit (we keep the
  // slug fixed at create time) so the YAML name is the only
  // unique-per-display handle the user controls post-create.
  // Without this check, two briefs could end up with the same name
  // in the sidebar and operators couldn't tell them apart.
  try {
    const existing = await getBriefList();
    const clash = existing.find(
      (b) => b.name === parsed.data.name && b.filename !== name
    );
    if (clash) {
      return NextResponse.json(
        {
          error: `Ja existeix un brief amb el nom «${parsed.data.name}» (${clash.filename}.yml). Tria un nom diferent.`,
        },
        { status: 409 }
      );
    }
  } catch {
    // Don't fail the edit if list-lookup itself fails.
  }

  try {
    const content = serializeBrief(parsed.data);
    const result = await writeBrief(name, content, payload.sha);
    revalidatePath("/", "layout");
    return NextResponse.json({ sha: result.sha });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
  request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { name } = await params;
  let payload;
  try {
    payload = (await request.json()) as { sha?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof payload.sha !== "string" || !payload.sha) {
    return NextResponse.json(
      { error: "Missing sha (last known commit sha for this file)" },
      { status: 400 }
    );
  }

  try {
    await deleteBrief(name, payload.sha);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

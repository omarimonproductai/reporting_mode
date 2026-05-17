import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getBriefList } from "@/lib/briefs";
import { BriefAlreadyExistsError, writeBrief } from "@/lib/github";
import { briefSchema } from "@/lib/schemas";
import { serializeBrief, slugifyBriefName } from "@/lib/yaml";

export async function GET(): Promise<NextResponse> {
  try {
    const briefs = await getBriefList();
    return NextResponse.json({ briefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload;
  try {
    payload = (await request.json()) as { brief?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = briefSchema.safeParse(payload.brief);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid brief payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const filename = slugifyBriefName(parsed.data.name);
  if (!filename) {
    return NextResponse.json(
      { error: "Name must include at least one alphanumeric character" },
      { status: 400 }
    );
  }

  // Reject duplicate display names across DIFFERENT filenames. The
  // filename-level collision is caught by writeBrief (422 from
  // GitHub → BriefAlreadyExistsError below) but two briefs with the
  // same display name but different slugs (different unicode, accent
  // variants, etc.) would otherwise both create with confusing
  // sidebar entries. Check before commit so the user sees a clear
  // error.
  try {
    const existing = await getBriefList();
    const clash = existing.find((b) => b.name === parsed.data.name);
    if (clash) {
      return NextResponse.json(
        {
          error: `Ja existeix un brief amb el nom «${parsed.data.name}» (${clash.filename}.yml). Tria un nom diferent.`,
        },
        { status: 409 }
      );
    }
  } catch {
    // Don't fail the create if the list-lookup itself fails — fall
    // back to the filename-level collision check below.
  }

  try {
    const content = serializeBrief(parsed.data);
    await writeBrief(filename, content);
    revalidatePath("/", "layout");
    return NextResponse.json({ filename }, { status: 201 });
  } catch (err) {
    if (err instanceof BriefAlreadyExistsError) {
      return NextResponse.json(
        { error: `A brief named "${filename}.yml" already exists` },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

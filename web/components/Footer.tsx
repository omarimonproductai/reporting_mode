import { getLatestCommit } from "@/lib/version";

function formatCatalunya(iso: string): string {
  const fmt = new Intl.DateTimeFormat("ca-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute} Catalunya`;
}

export async function Footer() {
  let buildLine: string;
  let timeLine: string | null = null;

  try {
    const commit = await getLatestCommit();
    buildLine = `Built ${commit.sha.slice(0, 7)}`;
    timeLine = formatCatalunya(commit.authoredAt);
  } catch {
    buildLine = "Version info unavailable";
  }

  return (
    <footer className="px-4 py-3 text-[11px] leading-tight text-zinc-400 font-mono">
      <div>{buildLine}</div>
      {timeLine && <div>{timeLine}</div>}
    </footer>
  );
}

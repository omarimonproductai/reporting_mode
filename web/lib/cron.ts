export type Minute = 0 | 15 | 30 | 45;
export const ALLOWED_MINUTES: Minute[] = [0, 15, 30, 45];

export type Frequency =
  | { kind: "daily" }
  | { kind: "weekly"; days: number[] }
  | { kind: "monthly"; dayOfMonth: number };

export type CronState = {
  frequency: Frequency;
  hour: number;
  minute: Minute;
};

const DAY_NAMES_CA = [
  "diumenge",
  "dilluns",
  "dimarts",
  "dimecres",
  "dijous",
  "divendres",
  "dissabte",
];

function isMinute(value: number): value is Minute {
  return ALLOWED_MINUTES.includes(value as Minute);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function buildCron(state: CronState): string {
  const m = state.minute;
  const h = state.hour;
  switch (state.frequency.kind) {
    case "daily":
      return `${m} ${h} * * *`;
    case "weekly": {
      const days = [...state.frequency.days].sort((a, b) => a - b);
      const dayPart = days.length > 0 ? days.join(",") : "*";
      return `${m} ${h} * * ${dayPart}`;
    }
    case "monthly":
      return `${m} ${h} ${state.frequency.dayOfMonth} * *`;
  }
}

export function parseCron(cron: string): CronState | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minStr, hourStr, domStr, monStr, dowStr] = parts;

  const minute = Number(minStr);
  if (!Number.isInteger(minute) || !isMinute(minute)) return null;

  const hour = Number(hourStr);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  if (monStr !== "*") return null;

  if (domStr === "*" && dowStr === "*") {
    return { frequency: { kind: "daily" }, hour, minute };
  }

  if (domStr === "*" && dowStr !== "*") {
    const days = dowStr.split(",").map(Number);
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return null;
    return { frequency: { kind: "weekly", days }, hour, minute };
  }

  if (domStr !== "*" && dowStr === "*") {
    const dayOfMonth = Number(domStr);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      return null;
    }
    return { frequency: { kind: "monthly", dayOfMonth }, hour, minute };
  }

  return null;
}

export function humanize(cron: string): string | null {
  const state = parseCron(cron);
  if (!state) return null;
  const time = `${pad2(state.hour)}:${pad2(state.minute)}`;
  switch (state.frequency.kind) {
    case "daily":
      return `Cada dia a les ${time}`;
    case "weekly": {
      const days = [...state.frequency.days].sort((a, b) => a - b);
      if (days.length === 0) {
        return `(cap dia seleccionat) a les ${time}`;
      }
      if (days.length === 7) {
        return `Cada dia a les ${time}`;
      }
      const names = days.map((d) => DAY_NAMES_CA[d]);
      if (names.length === 1) {
        return `Cada ${names[0]} a les ${time}`;
      }
      const head = names.slice(0, -1).join(", ");
      const tail = names[names.length - 1];
      return `Cada ${head} i ${tail} a les ${time}`;
    }
    case "monthly":
      return `El dia ${state.frequency.dayOfMonth} de cada mes a les ${time}`;
  }
}

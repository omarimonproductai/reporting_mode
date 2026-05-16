"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ALLOWED_MINUTES,
  buildCron,
  humanize,
  parseCron,
  type CronState,
  type Frequency,
  type Minute,
} from "@/lib/cron";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

type FrequencyKind = Frequency["kind"];

const DAY_BUTTONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Dl" },
  { value: 2, label: "Dt" },
  { value: 3, label: "Dc" },
  { value: 4, label: "Dj" },
  { value: 5, label: "Dv" },
  { value: 6, label: "Ds" },
  { value: 0, label: "Dg" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

const DEFAULT_STATE: CronState = {
  frequency: { kind: "daily" },
  hour: 8,
  minute: 0,
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function CronBuilder({ value, onChange }: Props) {
  const initial = useMemo(() => parseCron(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<"grid" | "custom">(
    initial ? "grid" : "custom"
  );
  const [state, setState] = useState<CronState>(initial ?? DEFAULT_STATE);
  const [customValue, setCustomValue] = useState(value);
  const lastEmittedRef = useRef<string>(value);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const parsed = parseCron(value);
    if (parsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("grid");
      setState(parsed);
    } else {
      setMode("custom");
      setCustomValue(value);
    }
    lastEmittedRef.current = value;
  }, [value]);

  function emit(cron: string) {
    lastEmittedRef.current = cron;
    onChange(cron);
  }

  function updateState(next: CronState) {
    setState(next);
    emit(buildCron(next));
  }

  function onFrequencyKindChange(kind: FrequencyKind) {
    let next: CronState;
    switch (kind) {
      case "daily":
        next = { ...state, frequency: { kind: "daily" } };
        break;
      case "hourly":
        next = { ...state, frequency: { kind: "hourly" } };
        break;
      case "weekly":
        next = { ...state, frequency: { kind: "weekly", days: [1, 2, 3, 4, 5] } };
        break;
      case "monthly":
        next = { ...state, frequency: { kind: "monthly", dayOfMonth: 1 } };
        break;
    }
    updateState(next);
  }

  function toggleWeekday(d: number) {
    if (state.frequency.kind !== "weekly") return;
    const current = state.frequency.days;
    const days = current.includes(d)
      ? current.filter((x) => x !== d)
      : [...current, d];
    updateState({ ...state, frequency: { kind: "weekly", days } });
  }

  function setDayOfMonth(dom: number) {
    if (state.frequency.kind !== "monthly") return;
    updateState({ ...state, frequency: { kind: "monthly", dayOfMonth: dom } });
  }

  function setHour(h: number) {
    updateState({ ...state, hour: h });
  }

  function setMinute(m: Minute) {
    updateState({ ...state, minute: m });
  }

  function resetToBuilder() {
    setMode("grid");
    setState(DEFAULT_STATE);
    emit(buildCron(DEFAULT_STATE));
  }

  if (mode === "custom") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            className="font-mono"
            value={customValue}
            onChange={(e) => {
              setCustomValue(e.target.value);
              emit(e.target.value);
            }}
            placeholder="0 8 * * *"
          />
          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            Custom
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Aquest cron no encaixa al constructor visual (minuts no múltiples de
          15, o forma no suportada). Pots editar-lo cru o tornar al
          constructor.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={resetToBuilder}
        >
          Reset to builder
        </Button>
      </div>
    );
  }

  const preview = humanize(buildCron(state));
  const rawCron = buildCron(state);
  const isHourly = state.frequency.kind === "hourly";
  const isWeekly = state.frequency.kind === "weekly";
  const isMonthly = state.frequency.kind === "monthly";

  return (
    <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50/40 p-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-zinc-600">Frequency</span>
        <Select
          value={state.frequency.kind}
          onValueChange={(v) => onFrequencyKindChange(v as FrequencyKind)}
        >
          <SelectTrigger className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Cada dia</SelectItem>
            <SelectItem value="weekly">Dies de la setmana</SelectItem>
            <SelectItem value="monthly">Dia del mes</SelectItem>
            <SelectItem value="hourly">Cada hora</SelectItem>
          </SelectContent>
        </Select>

        {isWeekly && state.frequency.kind === "weekly" && (
          <div className="flex flex-wrap gap-1">
            {DAY_BUTTONS.map((d) => {
              const selected = state.frequency.kind === "weekly" &&
                state.frequency.days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={cn(
                    "h-8 w-10 rounded-md border text-xs font-medium transition-colors",
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        )}

        {isMonthly && state.frequency.kind === "monthly" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">Dia</span>
            <Select
              value={String(state.frequency.dayOfMonth)}
              onValueChange={(v) => setDayOfMonth(Number(v))}
            >
              <SelectTrigger className="w-24 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_MONTH.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-zinc-500">de cada mes</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-zinc-600">
          {isHourly ? "Minute" : "Time"}
        </span>
        <div className="flex items-center gap-2">
          {!isHourly && (
            <>
              <Select
                value={String(state.hour)}
                onValueChange={(v) => setHour(Number(v))}
              >
                <SelectTrigger className="w-20 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {pad2(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-zinc-500">:</span>
            </>
          )}
          {isHourly && <span className="text-zinc-500">:</span>}
          <Select
            value={String(state.minute)}
            onValueChange={(v) => setMinute(Number(v) as Minute)}
          >
            <SelectTrigger className="w-20 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLOWED_MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {pad2(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-3">
        <div className="text-sm text-zinc-900">{preview ?? "—"}</div>
        <div className="mt-1 font-mono text-xs text-zinc-500">{rawCron}</div>
      </div>
    </div>
  );
}

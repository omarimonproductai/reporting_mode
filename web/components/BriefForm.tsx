"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
} from "react-hook-form";
import { toast } from "sonner";
import { Info, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ChannelCombobox } from "@/components/ChannelCombobox";
import { QueryCombobox } from "@/components/QueryCombobox";
import { ReportCombobox } from "@/components/ReportCombobox";
import { CronBuilder } from "@/components/CronBuilder";
import { useSpaceCatalog } from "@/lib/spaceCatalogClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { humanize } from "@/lib/cron";
import { briefSchema, type Brief } from "@/lib/schemas";

type FormMode = "view" | "edit";

type EditProps = {
  intent?: "edit";
  filename: string;
  initialBrief: Brief;
  initialSha: string;
  // When "edit" (driven by `?edit=1` on the detail page) the form lands
  // already in edit mode so the user doesn't have to click Edit first.
  // Used by the sidebar kebab's Edit action. Defaults to "view".
  initialMode?: FormMode;
  // Slot for page-level brief actions (Publish/Unpublish, Run Now,
  // History, etc.) so they render on the SAME row as the form's
  // Edit / Cancel + Save buttons — left side form actions, right
  // side brief actions. Lets the detail page header stay just the
  // title.
  briefActions?: React.ReactNode;
};

type CreateProps = {
  intent: "create";
  // Optional Mode report token to pre-fill in the first source.
  // Used by the Mode catalog landing's "Create brief →" CTA (the
  // page passes it through from the ?prefill_report=<token> query
  // string). Empty / undefined means no prefill — start from the
  // empty brief.
  prefillReportToken?: string;
  // Same slot as on EditProps for create-flow consistency.
  briefActions?: React.ReactNode;
};

type Props = EditProps | CreateProps;

const EMPTY_BRIEF: Brief = {
  name: "",
  published: false,
  schedule: "0 8 * * *",
  slack_channel: "",
  reference_link: "",
  sources: [{ mode_report_token: "", queries: [{ token: "", csv: false }] }],
  prompt: "",
  owner_email: null,
};

const formSchema = briefSchema;
type FormValues = z.infer<typeof formSchema>;

const FIELD_HELP = {
  name: 'Nom llegible del brief. Apareix a la barra lateral i com a títol del missatge a Slack. Format: text lliure. Exemple: «App Version Adoption». El nom del fitxer .yml es deriva d\'aquest valor només a la creació; editar-lo després no mou el fitxer.',
  schedule:
    "Quan s'executa el brief. El Schedule s'interpreta sempre amb l'hora local de Catalunya (canvis d'hora gestionats automàticament). Internament és una expressió cron de 5 camps (minut hora dia-mes mes dia-setmana). Exemples: «0 8 * * *» = cada dia a les 08:00; «0 10 * * 1» = cada dilluns a les 10:00.",
  slack_channel:
    'Canal de Slack on es publica el resultat. Format: només el nom, sense el «#» del davant. Exemple: «test-github-oriol». El bot ha de ser membre del canal abans del proper run; si encara no ho és, fes «/invite @cooltra-reporting-bot» dins del canal.',
  reference_link:
    "URL opcional que s'afegeix com a línia clicable al final del missatge de Slack. Útil per indicar als destinataris on poden veure les dades de referència o ampliar el context. Format: URL completa (https://...). Exemple: «https://app.mode.com/ecooltra706/reports/abc123».",
  prompt:
    "Instruccions que rep el LLM per generar el brief. Les dades de cada query s'adjunten automàticament al final del prompt en format JSON. Format: text lliure (pots usar markdown, llistes, seccions «## Title»). Sigues específic amb el format de sortida que esperes. Exemple: «Resumeix les dades en 3 bullets: tendència principal, anomalia més rellevant, recomanació concreta. No incloguis introducció.»",
  mode_report:
    'Identificador del report de Mode des d\'on s\'extrauen les dades. Format: l\'string alfanumèric que apareix a la URL del report a app.mode.com («/reports/<id>»). Exemple: «7b89f8a2f8d8». Un brief pot tenir múltiples sources, cadascun apuntant a un report diferent.',
  query_token:
    'Identificador d\'una query individual dins del report de Mode. Format: l\'string que apareix quan obres la query ampliada a Mode (URL: «/reports/<report>/queries/<query>»). Exemple: «4c71991707f0». Un mateix source pot tenir diverses queries del mateix report.',
  csv: "Marca-ho si vols rebre el CSV brut d'aquesta query com a resposta dins del thread del brief a Slack. Útil quan algú vol fer un anàlisi propi més enllà del resum del LLM. Per defecte: desmarcat (només arriba el resum textual). Cada query del source pot tenir CSV independent.",
};

function FieldHint({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          aria-label={`Info: ${label}`}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6} className="max-w-xs whitespace-normal text-left leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function LabelRow({
  htmlFor,
  children,
  hint,
  required = false,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: { text: string; label: string };
  required?: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>
        {children}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {hint && <FieldHint text={hint.text} label={hint.label} />}
    </div>
  );
}

function touchedAtPath(
  touched: unknown,
  path: string
): boolean {
  const parts = path.split(".");
  let cursor: unknown = touched;
  for (const p of parts) {
    if (!cursor || typeof cursor !== "object") return false;
    cursor = (cursor as Record<string, unknown>)[p];
  }
  return cursor === true;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function SchedulePreview({ cron }: { cron: string }) {
  const text = humanize(cron);
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="text-sm text-zinc-900">{text ?? "—"}</div>
      <div className="mt-1 font-mono text-xs text-zinc-500">{cron}</div>
    </div>
  );
}

function ReadonlyValue({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className={
        mono
          ? "rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 font-mono"
          : "rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
      }
    >
      {children}
    </div>
  );
}

// View-mode renderers for Mode tokens that look up the human name
// from the cached space catalog so the brief detail page surfaces
// reports and queries the same way the BriefForm comboboxes and
// the / landing do (name + token muted, not raw token alone).
// Falls back to the raw token in font-mono when the catalog is
// still loading or the token is no longer present in the space.
function ReportReadonly({ value }: { value: string }) {
  const { state } = useSpaceCatalog();
  const report =
    state.kind === "ready"
      ? state.catalog.reports.find((r) => r.token === value)
      : undefined;
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      {report ? (
        <>
          <div className="text-sm font-medium text-zinc-900">
            {report.name}
          </div>
          <div className="mt-0.5 font-mono text-xs text-zinc-400">
            {value}
          </div>
        </>
      ) : (
        <div className="font-mono text-sm text-zinc-900">{value}</div>
      )}
    </div>
  );
}

function QueryReadonly({
  value,
  reportToken,
}: {
  value: string;
  reportToken: string;
}) {
  const { state } = useSpaceCatalog();
  const parentReport =
    state.kind === "ready"
      ? state.catalog.reports.find((r) => r.token === reportToken)
      : undefined;
  const query = parentReport?.queries.find((q) => q.token === value);
  return (
    <div>
      {query ? (
        <>
          <div className="text-sm text-zinc-900">{query.name}</div>
          <div className="mt-0.5 font-mono text-xs text-zinc-400">
            {value}
          </div>
        </>
      ) : (
        <div className="font-mono text-sm text-zinc-900">{value}</div>
      )}
    </div>
  );
}

type SourceCardProps = {
  sourceIdx: number;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  isEditing: boolean;
  onRemoveSource: () => void;
  canRemoveSource: boolean;
  shouldShowError: (name: string) => boolean;
};

function SourceCard({
  sourceIdx,
  control,
  errors,
  isEditing,
  onRemoveSource,
  canRemoveSource,
  shouldShowError,
}: SourceCardProps) {
  const queries = useFieldArray({
    control,
    name: `sources.${sourceIdx}.queries`,
  });

  // Watched so the per-query combobox below can scope its list to the
  // queries that belong to this source's report. When the user changes
  // the report, the watched value updates and the comboboxes refilter.
  const watchedReportToken = useWatch({
    control,
    name: `sources.${sourceIdx}.mode_report_token` as const,
  }) ?? "";

  const sourceErrors = errors.sources?.[sourceIdx];

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-500">
          Source #{sourceIdx + 1}
        </div>
        {isEditing && canRemoveSource && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onRemoveSource}
            aria-label={`Remove source ${sourceIdx + 1}`}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <div className="mt-2">
        <LabelRow
          htmlFor={`mode_report_${sourceIdx}`}
          hint={{
            text: FIELD_HELP.mode_report,
            label: "Mode report",
          }}
          required
        >
          Mode report
        </LabelRow>
        {(() => {
          const fieldName = `sources.${sourceIdx}.mode_report_token`;
          const showErr = shouldShowError(fieldName);
          return (
            <>
              {isEditing ? (
                <Controller
                  control={control}
                  name={`sources.${sourceIdx}.mode_report_token` as const}
                  render={({ field }) => (
                    <ReportCombobox
                      value={field.value}
                      onChange={field.onChange}
                      ariaInvalid={
                        showErr && !!sourceErrors?.mode_report_token
                      }
                    />
                  )}
                />
              ) : (
                <Controller
                  control={control}
                  name={`sources.${sourceIdx}.mode_report_token` as const}
                  render={({ field }) => (
                    <ReportReadonly value={field.value} />
                  )}
                />
              )}
              {showErr && (
                <FieldError message={sourceErrors?.mode_report_token?.message} />
              )}
            </>
          );
        })()}
      </div>

      <div className="mt-4">
        <LabelRow
          hint={{ text: FIELD_HELP.query_token, label: "Queries" }}
          required
        >
          Queries
        </LabelRow>
        <div className="mt-2 flex flex-col gap-2">
          {queries.fields.map((queryField, qIdx) => {
            const queryErrors = sourceErrors?.queries?.[qIdx];
            const tokenName = `sources.${sourceIdx}.queries.${qIdx}.token`;
            const showTokenErr = shouldShowError(tokenName);
            return (
              <div
                key={queryField.id}
                className="flex items-start gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
              >
                <div className="flex-1">
                  {isEditing ? (
                    <Controller
                      control={control}
                      name={
                        `sources.${sourceIdx}.queries.${qIdx}.token` as const
                      }
                      render={({ field }) => (
                        <QueryCombobox
                          value={field.value}
                          onChange={field.onChange}
                          reportToken={watchedReportToken}
                          ariaInvalid={showTokenErr && !!queryErrors?.token}
                        />
                      )}
                    />
                  ) : (
                    <Controller
                      control={control}
                      name={
                        `sources.${sourceIdx}.queries.${qIdx}.token` as const
                      }
                      render={({ field }) => (
                        <QueryReadonly
                          value={field.value}
                          reportToken={watchedReportToken}
                        />
                      )}
                    />
                  )}
                  {showTokenErr && (
                    <FieldError message={queryErrors?.token?.message} />
                  )}
                </div>

                <label className="flex shrink-0 items-center gap-2 pt-2 text-sm text-zinc-700">
                  <Controller
                    control={control}
                    name={
                      `sources.${sourceIdx}.queries.${qIdx}.csv` as const
                    }
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        className="size-4 rounded border-zinc-300"
                        disabled={!isEditing}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    )}
                  />
                  CSV
                  <FieldHint text={FIELD_HELP.csv} label="CSV" />
                </label>

                {isEditing && queries.fields.length > 1 && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => queries.remove(qIdx)}
                    aria-label={`Remove query ${qIdx + 1}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            );
          })}
          {isEditing && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => queries.append({ token: "", csv: false })}
            >
              <Plus />
              Add query
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BriefForm(props: Props) {
  const router = useRouter();
  const isCreate = props.intent === "create";
  // In create mode, optionally pre-fill the first source's
  // mode_report_token from the prefillReportToken prop. The Mode
  // catalog landing's "Create brief →" CTA on a zero-brief query
  // navigates to /briefs/new?prefill_report=<token> and that token
  // surfaces here so the user lands on a partially-filled form.
  const initialBrief: Brief = isCreate
    ? props.prefillReportToken
      ? {
          ...EMPTY_BRIEF,
          sources: [
            {
              ...EMPTY_BRIEF.sources[0],
              mode_report_token: props.prefillReportToken,
            },
          ],
        }
      : EMPTY_BRIEF
    : props.initialBrief;
  const [mode, setMode] = useState<FormMode>(
    isCreate ? "edit" : (props.initialMode ?? "view")
  );
  const [sha, setSha] = useState(isCreate ? "" : props.initialSha);
  const [brief, setBrief] = useState(initialBrief);
  const [isSaving, setIsSaving] = useState(false);

  // Re-sync `sha` from props when the server re-renders with a
  // newer persisted state — e.g. PublishToggleButton mutates the
  // YAML behind us → router.refresh() → page passes the new
  // initialSha down. Without this, the form keeps the stale SHA
  // from initial mount and the next Save / Delete hits GitHub with
  // a SHA that no longer matches the current blob, surfacing as a
  // 409 «does not match» error.
  //
  // We deliberately do NOT re-sync `brief` state: that would clobber
  // in-progress user edits whenever a peripheral mutation lands. The
  // form is the source of truth for the editable fields once mounted;
  // external mutations only affect non-form state (the `published`
  // flag, which the form no longer renders since the toggle moved
  // to a top-level action button).
  const persistedSha = isCreate ? "" : props.initialSha;
  useEffect(() => {
    if (isCreate) return;
    if (persistedSha && persistedSha !== sha) {
      setSha(persistedSha);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedSha]);

  const defaultValues = useMemo<FormValues>(() => brief, [brief]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    trigger,
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    void trigger();
  }, [trigger]);

  const shouldShowError = (name: string): boolean => {
    if (isSubmitted) return true;
    return touchedAtPath(touchedFields, name);
  };

  const sources = useFieldArray({ control, name: "sources" });

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const isEditing = mode === "edit";

  function enterEdit() {
    reset(brief);
    setMode("edit");
  }

  function attemptCancel() {
    if (isCreate) {
      setCancelOpen(true);
      return;
    }
    reset(brief);
    setMode("view");
  }

  function confirmCancel() {
    setCancelOpen(false);
    router.push("/");
  }

  async function onDelete() {
    if (isCreate) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/briefs/${props.filename}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success("Brief esborrat");
      setDeleteOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`No s'ha pogut esborrar: ${message}`);
    } finally {
      setIsDeleting(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      if (isCreate) {
        const res = await fetch("/api/briefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: values }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { filename: string };
        toast.success("Brief creat");
        router.push(`/briefs/${data.filename}`);
        router.refresh();
        return;
      }

      const res = await fetch(`/api/briefs/${props.filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: values, sha }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { sha: string };
      setSha(data.sha);
      setBrief(values);
      reset(values);
      setMode("view");
      toast.success("Brief desat");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(
        isCreate
          ? `No s'ha pogut crear: ${message}`
          : `No s'ha pogut desar: ${message}`
      );
    } finally {
      setIsSaving(false);
    }
  }

  const actionButtons =
    mode === "view" ? (
      <Button type="button" size="sm" variant="outline" onClick={enterEdit}>
        Edit
      </Button>
    ) : (
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={attemptCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSaving || !isValid}>
          {isSaving
            ? isCreate
              ? "Creating…"
              : "Saving…"
            : isCreate
            ? "Create"
            : "Save"}
        </Button>
      </div>
    );

  const validityHint =
    mode === "edit" && !isValid ? (
      <p className="mt-2 text-right text-xs text-zinc-500">
        {isCreate
          ? "Omple els camps obligatoris per crear el brief."
          : "Hi ha camps obligatoris buits o invàlids; revisa els avisos en vermell."}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">{actionButtons}</div>
          {props.briefActions && (
            <div className="flex flex-wrap items-center gap-2">
              {props.briefActions}
            </div>
          )}
        </div>
        {validityHint}
      </div>

      <div>
        <LabelRow
          htmlFor="name"
          hint={{ text: FIELD_HELP.name, label: "Brief Name" }}
          required
        >
          Brief Name
        </LabelRow>
        {isEditing ? (
          <Input
            id="name"
            {...register("name")}
            aria-invalid={shouldShowError("name") && !!errors.name}
          />
        ) : (
          <ReadonlyValue>{brief.name}</ReadonlyValue>
        )}
        {shouldShowError("name") && (
          <FieldError message={errors.name?.message} />
        )}
      </div>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Content
        </h2>

        <div>
          <Label>Sources</Label>
          <div className="mt-2 flex flex-col gap-3">
            {sources.fields.map((sourceField, sIdx) => (
              <SourceCard
                key={sourceField.id}
                sourceIdx={sIdx}
                control={control}
                errors={errors}
                isEditing={isEditing}
                onRemoveSource={() => sources.remove(sIdx)}
                canRemoveSource={sources.fields.length > 1}
                shouldShowError={shouldShowError}
              />
            ))}
            {isEditing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() =>
                  sources.append({
                    mode_report_token: "",
                    queries: [{ token: "", csv: false }],
                  })
                }
              >
                <Plus />
                Add source
              </Button>
            )}
          </div>
        </div>

        <div>
          <LabelRow
            htmlFor="prompt"
            hint={{ text: FIELD_HELP.prompt, label: "Prompt" }}
            required
          >
            Prompt
          </LabelRow>
          {isEditing ? (
            <Textarea
              id="prompt"
              rows={20}
              className="font-mono text-sm"
              {...register("prompt")}
              aria-invalid={shouldShowError("prompt") && !!errors.prompt}
            />
          ) : (
            <pre className="mt-2 max-h-[40rem] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 whitespace-pre-wrap">
              {brief.prompt}
            </pre>
          )}
          {shouldShowError("prompt") && (
            <FieldError message={errors.prompt?.message} />
          )}
        </div>

        <div>
          <LabelRow
            htmlFor="reference_link"
            hint={{ text: FIELD_HELP.reference_link, label: "Reference link" }}
          >
            Reference link
          </LabelRow>
          {isEditing ? (
            <Input
              id="reference_link"
              type="url"
              placeholder="https://..."
              {...register("reference_link")}
              aria-invalid={
                shouldShowError("reference_link") && !!errors.reference_link
              }
            />
          ) : brief.reference_link ? (
            <ReadonlyValue mono>{brief.reference_link}</ReadonlyValue>
          ) : (
            <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm italic text-zinc-400">
              Cap reference link
            </div>
          )}
          {shouldShowError("reference_link") && (
            <FieldError message={errors.reference_link?.message} />
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Distribution
        </h2>

        <div>
          <LabelRow
            htmlFor="schedule"
            hint={{ text: FIELD_HELP.schedule, label: "Schedule" }}
            required
          >
            Schedule
          </LabelRow>
          {isEditing ? (
            <Controller
              control={control}
              name="schedule"
              render={({ field }) => (
                <CronBuilder value={field.value} onChange={field.onChange} />
              )}
            />
          ) : (
            <SchedulePreview cron={brief.schedule} />
          )}
          {shouldShowError("schedule") && (
            <FieldError message={errors.schedule?.message} />
          )}
        </div>

        <div>
          <LabelRow
            htmlFor="slack_channel"
            hint={{ text: FIELD_HELP.slack_channel, label: "Slack Channel" }}
            required
          >
            Slack Channel
          </LabelRow>
          {isEditing ? (
            <Controller
              control={control}
              name="slack_channel"
              render={({ field }) => (
                <ChannelCombobox
                  value={field.value}
                  onChange={field.onChange}
                  ariaInvalid={
                    shouldShowError("slack_channel") && !!errors.slack_channel
                  }
                />
              )}
            />
          ) : (
            <ReadonlyValue mono>#{brief.slack_channel}</ReadonlyValue>
          )}
          {shouldShowError("slack_channel") && (
            <FieldError message={errors.slack_channel?.message} />
          )}
        </div>
      </section>

      <div className="border-t border-zinc-200 pt-6">
        <div className="flex items-center justify-end gap-3">
          {actionButtons}
        </div>
        {validityHint}
      </div>

      {!isCreate && mode === "view" && (
        <div className="flex justify-end border-t border-zinc-200 pt-6">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Delete brief
          </Button>
        </div>
      )}

      {!isCreate && (
        <p className="pt-2 text-center text-[11px] text-zinc-400">
          Internament aquest brief ha estat desat com a{" "}
          <span className="font-mono">{props.filename}.yml</span>
        </p>
      )}

      {!isCreate && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete brief?</DialogTitle>
              <DialogDescription>
                Vols esborrar el brief «{brief.name}»? Aquesta acció és
                irreversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isCreate && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel create?</DialogTitle>
              <DialogDescription>
                Si cancel·les ara, es perdran tots els canvis que has fet en
                aquest formulari. Aquesta acció no es pot desfer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelOpen(false)}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmCancel}
              >
                Discard changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </form>
  );
}

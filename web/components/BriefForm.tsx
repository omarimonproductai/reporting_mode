"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { toast } from "sonner";
import { Info, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { briefSchema, type Brief } from "@/lib/schemas";

type FormMode = "view" | "edit";

type EditProps = {
  intent?: "edit";
  filename: string;
  initialBrief: Brief;
  initialSha: string;
  loadedAt: string;
};

type CreateProps = {
  intent: "create";
};

type Props = EditProps | CreateProps;

const EMPTY_BRIEF: Brief = {
  name: "",
  schedule: "0 8 * * *",
  slack_channel: "",
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
  prompt:
    "Instruccions que rep el LLM per generar el brief. Les dades de cada query s'adjunten automàticament al final del prompt. Format: text lliure (pots usar markdown, llistes, seccions «## Title»). Sigues específic amb el format de sortida que esperes.",
  mode_report:
    'Identificador del report de Mode des d\'on s\'extrauen les dades. Format: l\'string alfanumèric que apareix a la URL del report a app.mode.com («/reports/<id>»). Exemple: «7b89f8a2f8d8».',
  query_token:
    'Identificador d\'una query individual dins del report de Mode. Format: l\'string que apareix quan obres la query ampliada a Mode. Exemple: «4c71991707f0». Un mateix source pot tenir diverses queries.',
  csv: "Marca-ho si vols rebre el CSV brut d'aquesta query com a resposta dins del thread del brief a Slack. Útil quan algú vol fer un anàlisi propi més enllà del resum del LLM.",
};

function formatLoadedAt(iso: string): string {
  const fmt = new Intl.DateTimeFormat("ca-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date(iso));
}

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

type SourceCardProps = {
  sourceIdx: number;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  isEditing: boolean;
  onRemoveSource: () => void;
  canRemoveSource: boolean;
  shouldShowError: (name: string) => boolean;
};

function SourceCard({
  sourceIdx,
  control,
  register,
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
                <Input
                  id={`mode_report_${sourceIdx}`}
                  className="font-mono"
                  {...register(`sources.${sourceIdx}.mode_report_token` as const)}
                  aria-invalid={
                    showErr && !!sourceErrors?.mode_report_token
                  }
                />
              ) : (
                <Controller
                  control={control}
                  name={`sources.${sourceIdx}.mode_report_token` as const}
                  render={({ field }) => (
                    <ReadonlyValue mono>{field.value}</ReadonlyValue>
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
                    <Input
                      className="font-mono"
                      placeholder="Query token"
                      {...register(
                        `sources.${sourceIdx}.queries.${qIdx}.token` as const
                      )}
                      aria-invalid={showTokenErr && !!queryErrors?.token}
                    />
                  ) : (
                    <Controller
                      control={control}
                      name={
                        `sources.${sourceIdx}.queries.${qIdx}.token` as const
                      }
                      render={({ field }) => (
                        <div className="font-mono text-sm text-zinc-900">
                          {field.value}
                        </div>
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
  const initialBrief = isCreate ? EMPTY_BRIEF : props.initialBrief;
  const [mode, setMode] = useState<FormMode>(isCreate ? "edit" : "view");
  const [sha, setSha] = useState(isCreate ? "" : props.initialSha);
  const [brief, setBrief] = useState(initialBrief);
  const [isSaving, setIsSaving] = useState(false);

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

  const isEditing = mode === "edit";

  function enterEdit() {
    reset(brief);
    setMode("edit");
  }

  function cancelEdit() {
    if (isCreate) {
      router.push("/");
      return;
    }
    reset(brief);
    setMode("view");
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {isCreate
              ? "Nou brief"
              : `Carregat a ${formatLoadedAt(props.loadedAt)}`}
          </div>
          {mode === "view" ? (
            <Button type="button" size="sm" variant="outline" onClick={enterEdit}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
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
          )}
        </div>
        {mode === "edit" && !isValid && (
          <p className="mt-2 text-right text-xs text-zinc-500">
            {isCreate
              ? "Omple els camps obligatoris per crear el brief."
              : "Hi ha camps obligatoris buits o invàlids; revisa els avisos en vermell."}
          </p>
        )}
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
          Inputs
        </h2>

        <div>
          <Label>Sources</Label>
          <div className="mt-2 flex flex-col gap-3">
            {sources.fields.map((sourceField, sIdx) => (
              <SourceCard
                key={sourceField.id}
                sourceIdx={sIdx}
                control={control}
                register={register}
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
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Outputs
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
            <Input
              id="schedule"
              className="font-mono"
              {...register("schedule")}
              aria-invalid={shouldShowError("schedule") && !!errors.schedule}
            />
          ) : (
            <ReadonlyValue mono>{brief.schedule}</ReadonlyValue>
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
            <Input
              id="slack_channel"
              className="font-mono"
              {...register("slack_channel")}
              aria-invalid={
                shouldShowError("slack_channel") && !!errors.slack_channel
              }
            />
          ) : (
            <ReadonlyValue mono>#{brief.slack_channel}</ReadonlyValue>
          )}
          {shouldShowError("slack_channel") && (
            <FieldError message={errors.slack_channel?.message} />
          )}
        </div>
      </section>

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
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete brief?</DialogTitle>
              <DialogDescription>
                Vols esborrar el brief «{brief.name}»? Aquesta acció és
                recuperable des de l&apos;historial de git, però la propera
                execució programada no es disparrà.
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
    </form>
  );
}

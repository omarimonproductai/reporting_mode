"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
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
  timezone: "Europe/Madrid",
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
    'Quan s\'executa el brief. Format: cron de 5 camps (minut hora dia-mes mes dia-setmana). Exemples: «0 8 * * *» = cada dia a les 08:00; «0 10 * * 1» = cada dilluns a les 10:00.',
  timezone:
    'Zona horària amb què s\'interpreta el cron. Format: identificador IANA. Exemples: «Europe/Madrid» (per defecte, gestiona els canvis d\'hora), «UTC», «America/New_York».',
  slack_channel:
    'Canal de Slack on es publica el resultat. Format: només el nom, sense el «#» del davant. Exemple: «test-github-oriol». El bot ha de ser membre del canal abans del proper run; si encara no ho és, fes «/invite @cooltra-reporting-bot» dins del canal.',
  prompt:
    "Instruccions que rep el LLM per generar el brief. Les dades de cada query s'adjunten automàticament al final del prompt. Format: text lliure (pots usar markdown, llistes, seccions «## Title»). Sigues específic amb el format de sortida que esperes.",
  mode_report_token:
    'Token del report de Mode des d\'on s\'extrauen les dades. Format: l\'string alfanumèric que apareix a la URL del report a app.mode.com («/reports/<token>»). Exemple: «7b89f8a2f8d8».',
  query_token:
    'Token d\'una query individual dins del report de Mode. Format: l\'string que apareix quan obres la query ampliada a Mode. Exemple: «4c71991707f0». Un mateix source pot tenir diverses queries.',
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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          aria-label={`Info: ${label}`}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 text-xs text-zinc-700">
        {text}
      </PopoverContent>
    </Popover>
  );
}

function LabelRow({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: { text: string; label: string };
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      {hint && <FieldHint text={hint.text} label={hint.label} />}
    </div>
  );
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
};

function SourceCard({
  sourceIdx,
  control,
  register,
  errors,
  isEditing,
  onRemoveSource,
  canRemoveSource,
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
          htmlFor={`mode_report_token_${sourceIdx}`}
          hint={{
            text: FIELD_HELP.mode_report_token,
            label: "Mode report token",
          }}
        >
          Mode report token
        </LabelRow>
        {isEditing ? (
          <Input
            id={`mode_report_token_${sourceIdx}`}
            className="font-mono"
            {...register(`sources.${sourceIdx}.mode_report_token` as const)}
            aria-invalid={!!sourceErrors?.mode_report_token}
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
        <FieldError message={sourceErrors?.mode_report_token?.message} />
      </div>

      <div className="mt-4">
        <LabelRow hint={{ text: FIELD_HELP.query_token, label: "Queries" }}>
          Queries
        </LabelRow>
        <div className="mt-2 flex flex-col gap-2">
          {queries.fields.map((queryField, qIdx) => {
            const queryErrors = sourceErrors?.queries?.[qIdx];
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
                      aria-invalid={!!queryErrors?.token}
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
                  <FieldError message={queryErrors?.token?.message} />
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

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
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving
                ? isCreate
                  ? "Creant…"
                  : "Desant…"
                : isCreate
                ? "Create"
                : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div>
        <LabelRow htmlFor="name" hint={{ text: FIELD_HELP.name, label: "Name" }}>
          Name
        </LabelRow>
        {isEditing ? (
          <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        ) : (
          <ReadonlyValue>{brief.name}</ReadonlyValue>
        )}
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <LabelRow
            htmlFor="schedule"
            hint={{ text: FIELD_HELP.schedule, label: "Schedule" }}
          >
            Schedule (cron)
          </LabelRow>
          {isEditing ? (
            <Input
              id="schedule"
              className="font-mono"
              {...register("schedule")}
              aria-invalid={!!errors.schedule}
            />
          ) : (
            <ReadonlyValue mono>{brief.schedule}</ReadonlyValue>
          )}
          <FieldError message={errors.schedule?.message} />
        </div>

        <div>
          <LabelRow
            htmlFor="timezone"
            hint={{ text: FIELD_HELP.timezone, label: "Timezone" }}
          >
            Timezone
          </LabelRow>
          {isEditing ? (
            <Input
              id="timezone"
              {...register("timezone")}
              aria-invalid={!!errors.timezone}
            />
          ) : (
            <ReadonlyValue mono>{brief.timezone}</ReadonlyValue>
          )}
          <FieldError message={errors.timezone?.message} />
        </div>
      </div>

      <div>
        <LabelRow
          htmlFor="slack_channel"
          hint={{ text: FIELD_HELP.slack_channel, label: "Slack channel" }}
        >
          Slack channel
        </LabelRow>
        {isEditing ? (
          <Input
            id="slack_channel"
            className="font-mono"
            {...register("slack_channel")}
            aria-invalid={!!errors.slack_channel}
          />
        ) : (
          <ReadonlyValue mono>#{brief.slack_channel}</ReadonlyValue>
        )}
        <FieldError message={errors.slack_channel?.message} />
      </div>

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
        >
          Prompt
        </LabelRow>
        {isEditing ? (
          <Textarea
            id="prompt"
            rows={20}
            className="font-mono text-sm"
            {...register("prompt")}
            aria-invalid={!!errors.prompt}
          />
        ) : (
          <pre className="mt-2 max-h-[40rem] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 whitespace-pre-wrap">
            {brief.prompt}
          </pre>
        )}
        <FieldError message={errors.prompt?.message} />
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
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Esborrar brief?</DialogTitle>
              <DialogDescription>
                Vols esborrar <span className="font-mono">{props.filename}.yml</span>?
                Aquesta acció és recuperable des de l&apos;historial de git, però la
                propera execució programada no es disparrà.
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
                {isDeleting ? "Esborrant…" : "Esborrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </form>
  );
}

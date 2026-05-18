"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { BetaChip } from "@/components/BetaChip";
import { BriefMarkdown } from "@/components/BriefMarkdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { usePromptAssistant } from "@/hooks/usePromptAssistant";
import { cn } from "@/lib/utils";
import type { Brief } from "@/lib/schemas";

type Props = {
  open: boolean;
  onClose: () => void;
  // Closure returning the CURRENT form state (so unsaved edits feed
  // into the chat context). The Sheet reads `getBrief()` inside its
  // send handler, never at render time — letting the user edit the
  // form while the Sheet is open without the chat reading a stale
  // snapshot.
  getBrief: () => Brief;
  storageKey: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type State = {
  messages: ChatMessage[];
  status: "idle" | "streaming" | "error";
  pending: string;
  error?: string;
};

type Stored = {
  version: 1;
  messages: ChatMessage[];
  updatedAt: string;
};

const MESSAGE_CAP = 50;
const SUGGESTED_PROMPT_RE =
  /<suggested_prompt>([\s\S]*?)<\/suggested_prompt>/;

function loadStored(key: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.version !== 1 || !Array.isArray(parsed.messages)) return [];
    return parsed.messages;
  } catch {
    return [];
  }
}

function saveStored(key: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  const trimmed = messages.slice(-MESSAGE_CAP);
  const payload: Stored = {
    version: 1,
    messages: trimmed,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage unavailable — keep state in memory.
  }
}

export function PromptAssistantSheet({
  open,
  onClose,
  getBrief,
  storageKey,
}: Props) {
  const { applyPrompt } = usePromptAssistant();
  const [state, setState] = useState<State>({
    messages: [],
    status: "idle",
    pending: "",
  });
  const [input, setInput] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from localStorage on first mount of the sheet for this
  // brief. The storageKey changes per brief; resetting messages when
  // it changes keeps per-brief isolation.
  useEffect(() => {
    setState({
      messages: loadStored(storageKey),
      status: "idle",
      pending: "",
    });
  }, [storageKey]);

  // Persist on every messages change.
  useEffect(() => {
    saveStored(storageKey, state.messages);
  }, [state.messages, storageKey]);

  // Auto-scroll to the bottom when a new chunk arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages, state.pending]);

  // Abort any in-flight stream if the sheet closes mid-stream.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || state.status === "streaming") return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextMessages = [...state.messages, userMessage];
    setState({
      messages: nextMessages,
      status: "streaming",
      pending: "",
    });
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;

    const brief = getBrief();
    const payload = {
      messages: nextMessages,
      context: {
        briefName: brief.name,
        currentPrompt: brief.prompt,
        sources: brief.sources.map((s) => ({
          mode_report_token: s.mode_report_token,
          queries: s.queries.map((q) => ({ token: q.token })),
        })),
      },
    };

    let accumulated = "";
    try {
      const res = await fetch("/api/briefs/prompt-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const detail = res.ok ? "Resposta sense cos" : `HTTP ${res.status}`;
        setState((prev) => ({
          ...prev,
          status: "error",
          error: detail,
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const message = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const dataLine = message
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let event:
            | { kind: "delta"; delta: string }
            | { kind: "complete" }
            | { kind: "error"; message: string };
          try {
            event = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (event.kind === "delta") {
            accumulated += event.delta;
            setState((prev) => ({ ...prev, pending: accumulated }));
          } else if (event.kind === "complete") {
            setState((prev) => ({
              messages: [
                ...prev.messages,
                { role: "assistant", content: accumulated },
              ],
              status: "idle",
              pending: "",
            }));
          } else if (event.kind === "error") {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: event.message,
            }));
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User-initiated stop — promote the partial to a final
        // assistant message with the «(aturat)» marker.
        setState((prev) => ({
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: accumulated + "\n\n_(aturat)_",
            },
          ],
          status: "idle",
          pending: "",
        }));
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({ ...prev, status: "error", error: message }));
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clearConversation() {
    setState({ messages: [], status: "idle", pending: "" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setClearOpen(false);
  }

  function onApply(text: string) {
    applyPrompt(text);
    toast.success("Prompt actualitzat");
    onClose();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-2xl"
        >
          <SheetHeader className="shrink-0 pr-12">
            <SheetTitle className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-base font-medium">
                <Bot className="size-4 text-zinc-500" />
                Prompt Assistant
                <BetaChip />
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setClearOpen(true)}
                disabled={state.messages.length === 0}
                aria-label="Clear conversation"
              >
                <Trash2 />
                Clear
              </Button>
            </SheetTitle>
            <SheetDescription>
              T&apos;ajudo a escriure el prompt d&apos;aquest brief. Diga&apos;m
              què vols i et proposaré una versió que pots aplicar amb un
              clic.
            </SheetDescription>
          </SheetHeader>
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 pb-4"
          >
            {state.messages.length === 0 && state.status === "idle" && (
              <p className="pt-6 text-sm text-zinc-500">
                Diga&apos;m què vols que faci aquest brief i et proposaré
                un prompt. Per exemple: «vull que resumeixi l&apos;adopció
                d&apos;app version per setmana».
              </p>
            )}
            {state.messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                onApply={onApply}
                editable={true}
              />
            ))}
            {state.pending && state.status === "streaming" && (
              <MessageBubble
                message={{ role: "assistant", content: state.pending }}
                onApply={onApply}
                editable={false}
              />
            )}
            {state.status === "error" && state.error && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>No s&apos;ha pogut completar la resposta</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="border-t border-zinc-200 px-4 pt-3 pb-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Escriu el teu missatge…"
                rows={2}
                className="resize-none"
                disabled={state.status === "streaming"}
              />
              {state.status === "streaming" ? (
                <Button type="button" variant="outline" onClick={stop}>
                  <Square />
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void send()}
                  disabled={!input.trim()}
                >
                  <Send />
                  Send
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esborrar la conversa?</DialogTitle>
            <DialogDescription>
              S&apos;eliminarà tot l&apos;historial d&apos;aquest brief. No
              es pot desfer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={clearConversation}
            >
              Esborra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MessageBubble({
  message,
  onApply,
  editable,
}: {
  message: ChatMessage;
  onApply: (text: string) => void;
  editable: boolean;
}) {
  const isUser = message.role === "user";
  const match = !isUser ? SUGGESTED_PROMPT_RE.exec(message.content) : null;
  const cleanContent = match
    ? message.content.replace(SUGGESTED_PROMPT_RE, "").trim()
    : message.content;
  const suggested = match ? match[1].trim() : null;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-zinc-100 text-zinc-900"
            : "border border-zinc-200 bg-white text-zinc-900"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <BriefMarkdown>{cleanContent}</BriefMarkdown>
        )}
        {suggested && editable && (
          <div className="mt-2">
            <Button
              type="button"
              size="xs"
              onClick={() => onApply(suggested)}
            >
              Apply this prompt
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

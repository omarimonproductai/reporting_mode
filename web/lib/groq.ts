import "server-only";

import Groq from "groq-sdk";

// Must stay aligned with `scripts/executor.py:LLM_MODEL`. A future
// task can extract this to a shared config if model swaps become
// routine; for v1 we accept the one-place-per-language duplication.
export const LLM_MODEL = "llama-3.3-70b-versatile";
export const LLM_TEMPERATURE = 0.7;
export const LLM_MAX_TOKENS = 4096;

export type TokenUsage = {
  input: number;
  output: number;
  total: number;
};

export type StreamChunk =
  | { kind: "delta"; delta: string }
  | { kind: "done"; usage: TokenUsage };

let cachedClient: Groq | null = null;

function getGroqClient(): Groq {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to the Vercel env vars before " +
        "calling dry-run."
    );
  }
  cachedClient = new Groq({ apiKey });
  return cachedClient;
}

/**
 * Stream a chat completion from GROQ. Yields per-chunk deltas as they
 * arrive, then a final `done` chunk with token usage.
 *
 * Honours the AbortSignal — when the caller aborts (e.g. the dry-run
 * Sheet's Cancel button), the SDK closes the HTTP connection and the
 * iterator exits cleanly without yielding further chunks.
 */
export async function* streamChatCompletion(args: {
  systemPrompt: string;
  userMessage: string;
  signal?: AbortSignal;
}): AsyncGenerator<StreamChunk> {
  const client = getGroqClient();
  const stream = await client.chat.completions.create(
    {
      model: LLM_MODEL,
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      stream: true,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userMessage },
      ],
    },
    { signal: args.signal }
  );

  let lastUsage: TokenUsage = { input: 0, output: 0, total: 0 };
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      yield { kind: "delta", delta };
    }
    // GROQ exposes the final usage on the LAST chunk under
    // `x_groq.usage` (mirrors OpenAI's `usage` placement). Project
    // defensively — older SDK versions may surface it under a
    // different field; the dry-run still works without usage, the
    // numbers just stay at 0.
    const groqChunk = chunk as unknown as {
      x_groq?: {
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const usage = groqChunk.x_groq?.usage ?? groqChunk.usage;
    if (usage) {
      const input = usage.prompt_tokens ?? 0;
      const output = usage.completion_tokens ?? 0;
      lastUsage = {
        input,
        output,
        total: usage.total_tokens ?? input + output,
      };
    }
  }
  yield { kind: "done", usage: lastUsage };
}

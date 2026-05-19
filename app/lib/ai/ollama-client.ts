// lib/ai/ollama-client.ts
// Resilient Ollama client with retry, exponential backoff, streaming, and model fallback.

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

// ── Configuration ──────────────────────────────────────────────

interface ClientConfig {
  baseUrl: string;
  defaultModel: string;
  timeoutMs: number;        // per-request timeout
  maxRetries: number;       // retry attempts on failure
  backoffBaseMs: number;    // initial backoff delay
  backoffMaxMs: number;     // cap on backoff delay
}

const config: ClientConfig = {
  baseUrl: OLLAMA_BASE,
  defaultModel: OLLAMA_MODEL,
  timeoutMs: 120_000,       // 2 min — generous for large models
  maxRetries: 2,
  backoffBaseMs: 1_000,
  backoffMaxMs: 16_000,
};

// ── Types ──────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  tools?: ToolDefinition[];
  options?: {
    temperature?: number;
    num_predict?: number;
    num_ctx?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

interface OllamaTag {
  name: string;
  size: number;
}

// ── Helpers ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function computeBackoff(attempt: number): number {
  const delay = config.backoffBaseMs * Math.pow(2, attempt);
  return Math.min(delay, config.backoffMaxMs);
}

/** Find the best available model from the fallback chain */
async function findModel(preferred?: string): Promise<string> {
  const candidates = [
    preferred || config.defaultModel,
    config.defaultModel,
    'qwen2.5:7b',
    'qwen2.5:3b',
    'llama3.2:3b',
    'phi3:mini',
  ];

  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return candidates[0];

    const data: { models: OllamaTag[] } = await res.json();
    const available = data.models.map((m) => m.name);

    for (const candidate of candidates) {
      const base = candidate.split(':')[0];
      const found = available.find((n) => n.includes(base));
      if (found) return found;
    }

    return available[0] || candidates[0];
  } catch {
    return candidates[0];
  }
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Send a chat completion request to Ollama with retry + backoff.
 * Returns the full response (non-streaming).
 */
export async function chat(
  messages: ChatMessage[],
  opts?: {
    model?: string;
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<OllamaChatResponse> {
  const model = await findModel(opts?.model);
  const timeout = opts?.timeoutMs ?? config.timeoutMs;

  const body: OllamaChatRequest = {
    model,
    messages,
    stream: false,
    tools: opts?.tools,
    options: {
      temperature: opts?.temperature ?? 0.3,
      num_predict: opts?.maxTokens ?? 1024,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = computeBackoff(attempt - 1);
        console.log(`[ai] Retry ${attempt}/${config.maxRetries} after ${backoff}ms`);
        await sleep(backoff);
      }

      const res = await fetch(`${config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts?.signal ?? AbortSignal.timeout(timeout),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
      }

      const data: OllamaChatResponse = await res.json();
      console.log(
        `[ai] ${model} responded in ${data.total_duration ? (data.total_duration / 1e6).toFixed(0) : '?'}ms ` +
        `(${data.eval_count ?? '?'} tokens)`,
      );
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === 'AbortError') {
        console.error(`[ai] Timeout after ${timeout}ms (attempt ${attempt + 1})`);
        // Don't retry on user-aborted signals
        if (opts?.signal?.aborted) throw lastError;
        continue;
      }

      console.error(`[ai] Error (attempt ${attempt + 1}):`, lastError.message);
    }
  }

  throw lastError ?? new Error('Ollama unavailable after retries');
}

/**
 * Stream a chat completion — yields chunks as they arrive.
 * Falls back to non-streaming if streaming fails.
 */
export async function* chatStream(
  messages: ChatMessage[],
  opts?: {
    model?: string;
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  },
): AsyncGenerator<{ content: string; done: boolean; toolCalls?: OllamaChatResponse['message']['tool_calls'] }> {
  const model = await findModel(opts?.model);

  const body: OllamaChatRequest = {
    model,
    messages,
    stream: true,
    tools: opts?.tools,
    options: {
      temperature: opts?.temperature ?? 0.3,
      num_predict: opts?.maxTokens ?? 1024,
    },
  };

  const res = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts?.signal ?? AbortSignal.timeout(config.timeoutMs),
  });

  if (!res.ok) {
    // Fallback to non-streaming
    console.warn('[ai] Stream failed, falling back to non-stream');
    const result = await chat(messages, opts);
    yield { content: result.message.content, done: true, toolCalls: result.message.tool_calls };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const result = await chat(messages, opts);
    yield { content: result.message.content, done: true, toolCalls: result.message.tool_calls };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk: OllamaChatResponse = JSON.parse(line);
          yield {
            content: chunk.message?.content ?? '',
            done: chunk.done,
            toolCalls: chunk.message?.tool_calls,
          };
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Check Ollama availability and return status info.
 */
export async function checkStatus(): Promise<{
  available: boolean;
  model?: string;
  models?: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { available: false, error: `Status ${res.status}` };

    const data: { models: OllamaTag[] } = await res.json();
    const models = data.models.map((m) => m.name);

    if (models.length === 0) {
      return { available: true, models: [], error: 'No models installed. Run: ollama pull qwen2.5:7b' };
    }

    const model = await findModel();
    return { available: true, model, models };
  } catch {
    return { available: false, error: `Ollama not running at ${config.baseUrl}` };
  }
}

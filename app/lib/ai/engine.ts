// lib/ai/engine.ts
// Orchestrates the full AI pipeline: memory → prompt → LLM → tools → response.
// Falls back to pattern matching if LLM is unavailable.
// v2: Integrates ActionRegistry for mutation tools (create, update, etc.)

import { chat, chatStream, type ChatMessage } from './ollama-client';
import { toolDefinitions, executeTool } from './tools';
import { TOOL_DEFINITIONS } from './tool-definitions';
import { actionRegistry, type ActionContext, type ActionResult } from './actions';
import { buildSystemPrompt, buildConversationContext } from './prompts';
import { addMessage, getChatMessages, clearHistory } from './memory';
import { processQuestion } from '../assistant';

// ── Response Cache ─────────────────────────────────────────────

interface CacheEntry {
  answer: string;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30s — same queries get instant responses

function cacheKey(userId: string, question: string): string {
  return `${userId}:${question.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
}

function getCached(userId: string, question: string): string | null {
  const key = cacheKey(userId, question);
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.answer;
  }
  responseCache.delete(key);
  return null;
}

function setCache(userId: string, question: string, answer: string): void {
  const key = cacheKey(userId, question);
  responseCache.set(key, { answer, timestamp: Date.now() });
  // Limit cache size
  if (responseCache.size > 200) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
}

// ── Tool Execution (unified: query tools + action registry) ────

// Set of mutation tool names that should go through the ActionRegistry
const ACTION_TOOLS = new Set([
  'create_quote',
  'update_order_status',
  'create_product',
  'create_supplier',
  'generate_pdf_quote',
  'search_orders',
  'search_quotes',
  'get_low_stock',
  'get_financial_summary',
  'get_sales_report',
]);

/**
 * Execute a tool call — dispatches to ActionRegistry for mutation/action tools,
 * falls back to the existing query tools for read-only operations.
 */
async function executeToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  context: ActionContext,
): Promise<{ result: string; actionResult?: ActionResult }> {
  // Try ActionRegistry first for tools that modify data or have structured handlers
  if (ACTION_TOOLS.has(toolName)) {
    const actionResult = await actionRegistry.execute(toolName, toolArgs, context);
    return {
      result: JSON.stringify({
        success: actionResult.success,
        message: actionResult.message,
        data: actionResult.data,
      }),
      actionResult,
    };
  }

  // Fall back to existing query tools
  const result = executeTool(toolName, toolArgs);
  return { result };
}

// ── Main Engine ────────────────────────────────────────────────

export interface EngineResponse {
  answer: string;
  source: 'llm' | 'llm+tools' | 'pattern' | 'cache';
  toolsUsed: string[];
  actionResults?: ActionResult[];
}

/**
 * Process a user question through the full AI pipeline.
 *
 * Flow:
 * 1. Check response cache
 * 2. Try LLM with tool calling
 * 3. If LLM calls tools, execute them and feed results back
 * 4. If LLM unavailable, fall back to pattern matching
 */
export async function processWithAI(
  userId: string,
  question: string,
  signal?: AbortSignal,
  userRole: 'admin' | 'seller' = 'admin',
): Promise<EngineResponse> {
  // 1. Cache check (only for pure queries, not mutations)
  const cached = getCached(userId, question);
  if (cached) {
    return { answer: cached, source: 'cache', toolsUsed: [] };
  }

  // 2. Try LLM
  try {
    const result = await callLLMWithTools(userId, question, signal, userRole);

    // Cache the response (only if no mutations were performed)
    const hasMutations = result.toolsUsed.some(t => ACTION_TOOLS.has(t));
    if (!hasMutations) {
      setCache(userId, question, result.answer);
    }

    // Store in memory
    addMessage(userId, 'user', question);
    addMessage(userId, 'assistant', result.answer);

    return result;
  } catch (err) {
    console.warn('[ai:engine] LLM failed, falling back to pattern matching:', err instanceof Error ? err.message : err);
  }

  // 3. Fallback: pattern matching
  const fallback = processQuestion(question);
  addMessage(userId, 'user', question);
  addMessage(userId, 'assistant', fallback.answer);

  return { answer: fallback.answer, source: 'pattern', toolsUsed: [] };
}

/**
 * Stream a response from the LLM with tool calling.
 * Yields structured SSE events: tokens, tool execution, and completion.
 */
export async function* streamResponse(
  userId: string,
  question: string,
  signal?: AbortSignal,
  userRole: 'admin' | 'seller' = 'admin',
): AsyncGenerator<{
  type: 'token' | 'tool_start' | 'tool_result' | 'done' | 'error';
  chunk?: string;
  content?: string;
  tool?: string;
  params?: Record<string, unknown>;
  result?: ActionResult;
  done?: boolean;
  source?: string;
  toolsUsed?: string[];
  message?: string;
}> {
  const systemPrompt = buildSystemPrompt();
  const history = getChatMessages(userId);

  const contextMessages = buildConversationContext(history, 8);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...contextMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: question },
  ];

  const toolsUsed: string[] = [];
  const actionResults: ActionResult[] = [];
  let fullResponse = '';

  const actionContext: ActionContext = {
    userId,
    userRole,
  };

  try {
    // Use combined tool definitions (existing + new action tools)
    const allTools = TOOL_DEFINITIONS;

    // First call — might get tool calls
    const stream = chatStream(messages, {
      tools: allTools,
      temperature: 0.3,
      maxTokens: 1024,
      signal,
    });

    let pendingToolCalls: Array<{ function: { name: string; arguments: Record<string, unknown> } }> = [];

    for await (const chunk of stream) {
      if (chunk.toolCalls) {
        pendingToolCalls = chunk.toolCalls;
        continue;
      }

      if (chunk.content) {
        fullResponse += chunk.content;
        yield { type: 'token', chunk: chunk.content };
      }

      if (chunk.done && pendingToolCalls.length > 0) {
        // Execute tools and make a second call
        const toolMessages = [...messages];

        // Add assistant message with tool calls
        toolMessages.push({
          role: 'assistant',
          content: fullResponse || '',
        });

        // Execute each tool
        for (const tc of pendingToolCalls) {
          const toolName = tc.function.name;
          const toolArgs = tc.function.arguments || {};
          toolsUsed.push(toolName);

          // Emit tool_start event
          yield {
            type: 'tool_start',
            tool: toolName,
            params: toolArgs,
          };

          console.log(`[ai:engine] Executing tool: ${toolName}`);
          const { result, actionResult } = await executeToolCall(toolName, toolArgs, actionContext);

          if (actionResult) {
            actionResults.push(actionResult);
          }

          // Emit tool_result event
          yield {
            type: 'tool_result',
            tool: toolName,
            result: actionResult || { success: true, message: result, data: undefined },
          };

          toolMessages.push({
            role: 'tool' as const,
            content: result,
          });
        }

        // Second LLM call with tool results
        fullResponse = '';
        const stream2 = chatStream(toolMessages, {
          temperature: 0.3,
          maxTokens: 1024,
          signal,
        });

        for await (const chunk2 of stream2) {
          if (chunk2.content) {
            fullResponse += chunk2.content;
            yield { type: 'token', chunk: chunk2.content };
          }
        }
      }
    }

    // Store in memory
    addMessage(userId, 'user', question);
    addMessage(userId, 'assistant', fullResponse);

    // Cache (only if no mutations)
    const hasMutations = toolsUsed.some(t => ACTION_TOOLS.has(t));
    if (fullResponse && !hasMutations) setCache(userId, question, fullResponse);

    yield {
      type: 'done',
      source: toolsUsed.length > 0 ? 'llm+tools' : 'llm',
      toolsUsed,
    };
  } catch (err) {
    console.warn('[ai:engine] Stream failed:', err instanceof Error ? err.message : err);

    // Fallback to pattern matching
    const fallback = processQuestion(question);
    addMessage(userId, 'user', question);
    addMessage(userId, 'assistant', fallback.answer);

    yield {
      type: 'token',
      chunk: fallback.answer,
    };
    yield {
      type: 'done',
      source: 'pattern',
      toolsUsed: [],
    };
  }
}

/**
 * Non-streaming version — collects the full response.
 */
async function callLLMWithTools(
  userId: string,
  question: string,
  signal?: AbortSignal,
  userRole: 'admin' | 'seller' = 'admin',
): Promise<EngineResponse> {
  const systemPrompt = buildSystemPrompt();
  const history = getChatMessages(userId);

  const contextMessages = buildConversationContext(history, 8);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...contextMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: question },
  ];

  const toolsUsed: string[] = [];
  const actionResults: ActionResult[] = [];
  const actionContext: ActionContext = { userId, userRole };

  const allTools = TOOL_DEFINITIONS;

  // First call
  const response = await chat(messages, {
    tools: allTools,
    temperature: 0.3,
    maxTokens: 1024,
    signal,
  });

  // Check for tool calls
  const toolCalls = response.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    // Execute tools
    const toolMessages = [...messages, { role: 'assistant' as const, content: response.message.content }];

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      const toolArgs = tc.function.arguments || {};
      toolsUsed.push(toolName);

      console.log(`[ai:engine] Executing tool: ${toolName}`);
      const { result, actionResult } = await executeToolCall(toolName, toolArgs, actionContext);

      if (actionResult) {
        actionResults.push(actionResult);
      }

      toolMessages.push({ role: 'tool' as const, content: result });
    }

    // Second call with tool results
    const finalResponse = await chat(toolMessages, {
      temperature: 0.3,
      maxTokens: 1024,
      signal,
    });

    return {
      answer: finalResponse.message.content,
      source: 'llm+tools',
      toolsUsed,
      actionResults,
    };
  }

  return {
    answer: response.message.content,
    source: 'llm',
    toolsUsed,
  };
}

/**
 * Clear conversation memory for a user.
 */
export function clearConversation(userId: string): void {
  clearHistory(userId);
}

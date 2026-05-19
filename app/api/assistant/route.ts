// app/api/assistant/route.ts
// AI Assistant API — streaming + tool calling + action execution.
// v2: Structured SSE events, permission-aware tool execution.

import { NextResponse } from 'next/server';
import { processWithAI, streamResponse, clearConversation, checkStatus } from '../../lib/ai';
import { requireRole } from '../../lib/auth';

// ── SSE Event Types ────────────────────────────────────────────
//
// { type: "token", content: "..." }           — LLM text token
// { type: "tool_start", tool: "create_quote", params: {...} }  — tool execution starting
// { type: "tool_result", tool: "create_quote", result: {...} } — tool execution result
// { type: "done", source: "llm+tools", toolsUsed: [...] }     — stream complete
// { type: "error", message: "..." }           — error occurred

// ── POST — Process question (streaming or JSON) ───────────────

export async function POST(request: Request) {
  let payload: { userId: string; role: string };
  try {
    payload = requireRole(request, ['admin', 'seller']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { question, stream: wantsStream, clear: wantsClear } = body as {
    question?: string;
    stream?: boolean;
    clear?: boolean;
  };

  // Clear conversation
  if (wantsClear) {
    clearConversation(payload.userId);
    return NextResponse.json({ message: 'Conversa limpa.' });
  }

  if (!question?.trim()) {
    return NextResponse.json({ error: 'Faça uma pergunta.' }, { status: 400 });
  }

  const q = question.trim();
  const controller = new AbortController();
  const signal = controller.signal;
  const userRole = (payload.role as 'admin' | 'seller') || 'admin';

  // Handle client disconnect
  request.signal.addEventListener('abort', () => controller.abort());

  // Timeout handling (2 minutes max)
  const timeout = setTimeout(() => controller.abort(), 120_000);

  // ── Streaming mode ───────────────────────────────────────────
  if (wantsStream) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(streamController) {
        try {
          for await (const event of streamResponse(payload.userId, q, signal, userRole)) {
            if (signal.aborted) break;

            const data = JSON.stringify(event);
            streamController.enqueue(encoder.encode(`data: ${data}\n\n`));

            if (event.type === 'done') {
              streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
          }
        } catch (err) {
          const errorEvent = JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Erro desconhecido',
          });
          streamController.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          clearTimeout(timeout);
          streamController.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  }

  // ── Non-streaming mode ───────────────────────────────────────
  try {
    const result = await processWithAI(payload.userId, q, signal, userRole);
    clearTimeout(timeout);
    return NextResponse.json(result);
  } catch (err) {
    clearTimeout(timeout);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro no assistente.' },
      { status: 500 },
    );
  }
}

// ── GET — Ollama status ───────────────────────────────────────

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 },
    );
  }

  const status = await checkStatus();
  return NextResponse.json(status);
}

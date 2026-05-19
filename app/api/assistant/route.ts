// app/api/assistant/route.ts
// AI Assistant API — streaming + tool calling + pattern matching fallback.

import { NextResponse } from 'next/server';
import { processWithAI, streamResponse, clearConversation, checkStatus } from '../../lib/ai';
import { requireRole } from '../../lib/auth';

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

  // Handle client disconnect
  request.signal.addEventListener('abort', () => controller.abort());

  // ── Streaming mode ───────────────────────────────────────────
  if (wantsStream) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamResponse(payload.userId, q, signal)) {
            if (signal.aborted) break;

            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            if (event.done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
          }
        } catch (err) {
          const errorData = JSON.stringify({
            chunk: `Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
            done: true,
            source: 'error',
            toolsUsed: [],
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // ── Non-streaming mode ───────────────────────────────────────
  try {
    const result = await processWithAI(payload.userId, q, signal);
    return NextResponse.json(result);
  } catch (err) {
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

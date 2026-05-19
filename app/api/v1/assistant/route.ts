// api/v1/assistant/route.ts
// V1 standardized assistant endpoint.

import { processWithAI, streamResponse, clearConversation, checkStatus } from '../../../../lib/ai';
import { requireRole } from '../../../../lib/auth';
import { ok, badRequest, fromError } from '../../../../lib/api-response';

export async function POST(request: Request) {
  let payload: { userId: string; role: string };
  try {
    payload = requireRole(request, ['admin', 'seller']);
  } catch (error) {
    return fromError(error);
  }

  const body = await request.json().catch(() => ({}));
  const { question, stream: wantsStream, clear: wantsClear } = body as {
    question?: string; stream?: boolean; clear?: boolean;
  };

  if (wantsClear) {
    clearConversation(payload.userId);
    return ok({ message: 'Conversa limpa.' });
  }

  if (!question?.trim()) return badRequest('Faça uma pergunta.');

  const q = question.trim();
  const controller = new AbortController();
  const signal = controller.signal;
  const userRole = (payload.role as 'admin' | 'seller') || 'admin';

  request.signal.addEventListener('abort', () => controller.abort());
  const timeout = setTimeout(() => controller.abort(), 120_000);

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(streamController) {
        try {
          for await (const event of streamResponse(payload.userId, q, signal, userRole)) {
            if (signal.aborted) break;
            const data = JSON.stringify(event);
            streamController.enqueue(encoder.encode(`data: ${data}\n\n`));
            if (event.type === 'done') streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
        } catch (err) {
          const errorEvent = JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Erro desconhecido' });
          streamController.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          clearTimeout(timeout);
          streamController.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
    });
  }

  try {
    const result = await processWithAI(payload.userId, q, signal, userRole);
    clearTimeout(timeout);
    return ok(result);
  } catch (err) {
    clearTimeout(timeout);
    return fromError(err);
  }
}

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);
    const status = await checkStatus();
    return ok(status);
  } catch (error) {
    return fromError(error);
  }
}

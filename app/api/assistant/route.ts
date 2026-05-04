// app/api/assistant/route.ts
// API endpoint do assistente inteligente local
// POST: recebe pergunta, retorna resposta com dados reais

import { NextResponse } from 'next/server';
import { processQuestion } from '../../lib/assistant';
import { requireRole } from '../../lib/auth';

/**
 * POST /api/assistant
 * Body: { question: string }
 * Retorna resposta baseada em dados reais do sistema.
 */
export async function POST(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const body = await request.json();
    const { question } = body as { question?: string };

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'Envie uma pergunta válida.' }, { status: 400 });
    }

    const response = processQuestion(question.trim());
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar pergunta.' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }
}

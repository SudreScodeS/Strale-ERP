// app/api/fraud/route.ts
// API endpoint para o sistema de detecção de fraude
// GET: resumo de fraudes e lista de logs
// PATCH: revisão de log de fraude pelo admin

import { NextResponse } from 'next/server';
import { getFraudSummary, reviewFraudLog, buildUserRiskProfile } from '../../lib/fraud-detection';
import { fraudLogData } from '../../lib/data';
import { requireRole } from '../../lib/auth';

/**
 * GET /api/fraud
 * Retorna resumo de fraudes para o dashboard.
 * Query params opcionais:
 *   - mode=logs → lista todos os logs
 *   - mode=profile&userId=xxx → perfil de risco do usuário
 *   - logId=xxx → log específico
 */
export async function GET(request: Request) {
  try {
    const payload = requireRole(request, ['admin']);
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    const userId = searchParams.get('userId');
    const logId = searchParams.get('logId');

    // Modo: log específico
    if (logId) {
      const log = fraudLogData.getById(logId);
      if (!log) {
        return NextResponse.json({ error: 'Log não encontrado' }, { status: 404 });
      }
      return NextResponse.json({ log });
    }

    // Modo: perfil de risco de um usuário
    if (mode === 'profile' && userId) {
      const profile = buildUserRiskProfile(userId);
      return NextResponse.json({ profile });
    }

    // Modo: todos os logs
    if (mode === 'logs') {
      const logs = fraudLogData.getAll()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ logs });
    }

    // Modo padrão: resumo para dashboard
    const summary = getFraudSummary();
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar dados de fraude.' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }
}

/**
 * PATCH /api/fraud
 * Revisa um log de fraude (ação do admin).
 * Body: { logId, status, note? }
 */
export async function PATCH(request: Request) {
  try {
    const payload = requireRole(request, ['admin']);
    const body = await request.json();
    const { logId, status, note } = body as { logId: string; status: string; note?: string };

    if (!logId || !status) {
      return NextResponse.json({ error: 'logId e status são obrigatórios.' }, { status: 400 });
    }

    if (!['aprovado', 'suspeito', 'bloqueado'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido. Use: aprovado, suspeito ou bloqueado.' }, { status: 400 });
    }

    const updated = reviewFraudLog(logId, payload.userId, status as 'aprovado' | 'suspeito' | 'bloqueado', note);
    if (!updated) {
      return NextResponse.json({ error: 'Log não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ log: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao revisar log.' },
      { status: 500 },
    );
  }
}

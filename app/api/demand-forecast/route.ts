// app/api/demand-forecast/route.ts
// API endpoint para o sistema de previsão de demanda local
// Retorna análise completa de demanda, tendências e recomendações de estoque

import { NextResponse } from 'next/server';
import {
  getDemandForecastSummary,
  getVariableSalesHistory,
  getWeeklySalesData,
} from '../../lib/demand-forecast';

/**
 * GET /api/demand-forecast
 * Retorna o resumo completo de previsão de demanda.
 * Usado pelo dashboard principal.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const variableId = searchParams.get('variableId');
  const mode = searchParams.get('mode');

  // Modo: histórico de uma variável específica
  if (mode === 'history' && variableId) {
    const history = getVariableSalesHistory(variableId);
    if (!history) {
      return NextResponse.json({ error: 'Variável não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ history });
  }

  // Modo: dados semanais para gráficos
  if (mode === 'weekly') {
    const weeklyData = getWeeklySalesData();
    return NextResponse.json({ weeklyData });
  }

  // Modo padrão: resumo completo
  const summary = getDemandForecastSummary();
  return NextResponse.json({ summary });
}

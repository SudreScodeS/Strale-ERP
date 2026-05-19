// api/v1/demand-forecast/route.ts
// V1 standardized demand forecast endpoint.

import { getDemandForecastSummary, getVariableSalesHistory, getWeeklySalesData } from '../../../../lib/demand-forecast';
import { requireRole } from '../../../../lib/auth';
import { ok, notFound, fromError } from '../../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
    const { searchParams } = new URL(request.url);
    const variableId = searchParams.get('variableId');
    const mode = searchParams.get('mode');

    if (mode === 'history' && variableId) {
      const history = getVariableSalesHistory(variableId);
      if (!history) return notFound('Variável não encontrada.');
      return ok({ history });
    }

    if (mode === 'weekly') {
      const weeklyData = getWeeklySalesData();
      return ok({ weeklyData });
    }

    const summary = getDemandForecastSummary();
    return ok({ summary });
  } catch (error) {
    return fromError(error);
  }
}

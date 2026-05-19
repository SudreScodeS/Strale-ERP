// api/v1/finance/route.ts
// V1 standardized finance endpoint.

import { requireRole } from '../../../lib/auth';
import { getFinancialRecords } from '../../../lib/finance';
import { ok, fromError } from '../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const summary = getFinancialRecords(fromDate, toDate);
    return ok(summary);
  } catch (error) {
    return fromError(error);
  }
}

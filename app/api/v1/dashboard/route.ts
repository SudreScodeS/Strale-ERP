// api/v1/dashboard/route.ts
// V1 standardized dashboard endpoint.

import { requireRole } from '../../../lib/auth';
import { getDashboardSummary } from '../../../lib/dashboard';
import { ok, fromError } from '../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
    const summary = getDashboardSummary();
    return ok(summary);
  } catch (error) {
    return fromError(error);
  }
}

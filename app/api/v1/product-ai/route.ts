// api/v1/product-ai/route.ts
// V1 standardized product AI endpoint.

import { requireRole } from '../../../../lib/auth';
import { getProductAIReport } from '../../../../lib/product-ai';
import { ok, fromError } from '../../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
    return ok(getProductAIReport());
  } catch (error) {
    return fromError(error);
  }
}

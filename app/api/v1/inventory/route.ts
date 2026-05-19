// api/v1/inventory/route.ts
// V1 standardized inventory endpoint.

import { getInventoryState } from '../../../../lib/inventory';
import { requireRole } from '../../../../lib/auth';
import { ok, fromError } from '../../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);
    const inventory = getInventoryState();
    return ok(inventory);
  } catch (error) {
    return fromError(error);
  }
}

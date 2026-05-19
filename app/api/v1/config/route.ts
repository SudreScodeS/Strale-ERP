// api/v1/config/route.ts
// V1 standardized config endpoint.

import { loadServerConfig, updateServerConfig } from '../../../lib/config';
import { requireRole } from '../../../lib/auth';
import { ok, fromError, success } from '../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);
    const config = loadServerConfig();
    return ok({ config });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);

    const body = await request.json();
    const { systemName, companyName, ...safeUpdates } = body;
    const updated = updateServerConfig(safeUpdates);
    return ok({ config: updated }, 'Configurações atualizadas com sucesso.');
  } catch (error) {
    return fromError(error);
  }
}

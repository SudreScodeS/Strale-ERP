// api/v1/inventory/group/route.ts
// V1 standardized inventory group endpoint.

import { v4 as uuidv4 } from 'uuid';
import { groupData, productData, variableData } from '../../../../../lib/data';
import { requireRole } from '../../../../../lib/auth';
import { ok, created, badRequest, notFound, fromError } from '../../../../../lib/api-response';

const DEFAULT_WATCH_STOCK_ALERT = 30;
const DEFAULT_CRITICAL_STOCK_ALERT = 10;

function normalizeAlertLimits(watchStockAlert?: number, criticalStockAlert?: number) {
  const watch = Number.isFinite(watchStockAlert) ? Math.max(0, Number(watchStockAlert)) : DEFAULT_WATCH_STOCK_ALERT;
  const critical = Number.isFinite(criticalStockAlert) ? Math.max(0, Number(criticalStockAlert)) : DEFAULT_CRITICAL_STOCK_ALERT;
  if (critical > watch) return { error: 'O limite crítico deve ser menor ou igual ao limite de atenção.' as const };
  return { watchStockAlert: watch, criticalStockAlert: critical };
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { productId, name, watchStockAlert, criticalStockAlert } = body as {
      productId: string; name: string; watchStockAlert?: number; criticalStockAlert?: number;
    };

    if (!productId || !name) return badRequest('Produto e nome do grupo são obrigatórios.');
    const limits = normalizeAlertLimits(watchStockAlert, criticalStockAlert);
    if ('error' in limits) return badRequest(limits.error);

    groupData.create({
      id: uuidv4(), productId, name,
      watchStockAlert: limits.watchStockAlert,
      criticalStockAlert: limits.criticalStockAlert,
      createdAt: new Date(),
    });

    return created({ message: 'Grupo criado com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { id, productId, name, watchStockAlert, criticalStockAlert } = body as {
      id: string; productId?: string; name?: string; watchStockAlert?: number; criticalStockAlert?: number;
    };

    if (!id) return badRequest('ID do grupo é obrigatório.');
    const existing = groupData.getAll().find((group) => group.id === id);
    if (!existing) return notFound('Grupo não encontrado.');
    if (productId && !productData.getById(productId)) return notFound('Produto vinculado não encontrado.');

    const updates: { productId?: string; name?: string; watchStockAlert?: number; criticalStockAlert?: number } = {};
    if (productId) updates.productId = productId;
    if (name) updates.name = name;
    if (watchStockAlert !== undefined || criticalStockAlert !== undefined) {
      const limits = normalizeAlertLimits(watchStockAlert ?? existing.watchStockAlert, criticalStockAlert ?? existing.criticalStockAlert);
      if ('error' in limits) return badRequest(limits.error);
      updates.watchStockAlert = limits.watchStockAlert;
      updates.criticalStockAlert = limits.criticalStockAlert;
    }
    groupData.update(id, updates);
    return ok({ message: 'Grupo atualizado com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return badRequest('ID do grupo é obrigatório.');

    const existing = groupData.getAll().find((group) => group.id === id);
    if (!existing) return notFound('Grupo não encontrado.');

    const variables = variableData.getByGroupId(id);
    variables.forEach((variable) => variableData.delete(variable.id));
    groupData.delete(id);
    return ok({ message: 'Grupo excluído com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

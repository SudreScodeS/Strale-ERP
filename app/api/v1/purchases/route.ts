// api/v1/purchases/route.ts
// V1 standardized purchases endpoint.

import { PurchaseItem } from '../../../../types';
import { createPurchaseOrder, deletePurchaseOrder, getPurchaseDashboard, updatePurchaseOrder } from '../../../lib/purchases';
import { requireRole } from '../../../lib/auth';
import { ok, created, badRequest, notFound, fromError } from '../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
    const data = getPurchaseDashboard();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { supplierId, items, purchasedAt } = body as { supplierId: string; items: PurchaseItem[]; purchasedAt?: string };

    if (!supplierId || !items || items.length === 0) return badRequest('Dados inválidos para pedido de compra.');
    const invalidItem = items.find((item) => !item.variableId || item.quantity <= 0 || item.unitCost < 0);
    if (invalidItem) return badRequest('Itens de compra inválidos.');

    const purchaseOrder = createPurchaseOrder(supplierId, items, purchasedAt);
    return created({ purchaseOrder }, 'Compra registrada com sucesso.');
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { id, supplierId, items, purchasedAt } = body as { id: string; supplierId: string; items: PurchaseItem[]; purchasedAt?: string };

    if (!id || !supplierId || !items || items.length === 0) return badRequest('Dados inválidos para editar compra.');
    const invalidItem = items.find((item) => !item.variableId || item.quantity <= 0 || item.unitCost < 0);
    if (invalidItem) return badRequest('Itens de compra inválidos.');

    try {
      updatePurchaseOrder(id, { supplierId, items, purchasedAt });
      return ok({ message: 'Compra atualizada com sucesso.' });
    } catch (error) {
      return notFound(error instanceof Error ? error.message : 'Compra não encontrada.');
    }
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return badRequest('ID da compra é obrigatório.');

    try {
      deletePurchaseOrder(id);
      return ok({ message: 'Compra excluída com sucesso.' });
    } catch (error) {
      return notFound(error instanceof Error ? error.message : 'Compra não encontrada.');
    }
  } catch (error) {
    return fromError(error);
  }
}

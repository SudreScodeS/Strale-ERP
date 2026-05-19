import { NextResponse } from 'next/server';
import { PurchaseItem } from '../../../types';
import { createPurchaseOrder, deletePurchaseOrder, getPurchaseDashboard, updatePurchaseOrder } from '../../lib/purchases';
import { requireRole } from '../../lib/auth';

export async function GET(request: Request) {
  requireRole(request, ['admin']);
  const data = getPurchaseDashboard();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  requireRole(request, ['admin']);
  const body = await request.json();
  const { supplierId, items, purchasedAt } = body as { supplierId: string; items: PurchaseItem[]; purchasedAt?: string };

  if (!supplierId || !items || items.length === 0) {
    return NextResponse.json({ message: 'Dados inválidos para pedido de compra.' }, { status: 400 });
  }

  const invalidItem = items.find((item) => !item.variableId || item.quantity <= 0 || item.unitCost < 0);
  if (invalidItem) {
    return NextResponse.json({ message: 'Itens de compra inválidos.' }, { status: 400 });
  }

  const purchaseOrder = createPurchaseOrder(supplierId, items, purchasedAt);
  return NextResponse.json({ purchaseOrder, message: 'Compra registrada com sucesso.' });
}

export async function PATCH(request: Request) {
  requireRole(request, ['admin']);
  const body = await request.json();
  const { id, supplierId, items, purchasedAt } = body as {
    id: string;
    supplierId: string;
    items: PurchaseItem[];
    purchasedAt?: string;
  };

  if (!id || !supplierId || !items || items.length === 0) {
    return NextResponse.json({ message: 'Dados inválidos para editar compra.' }, { status: 400 });
  }

  const invalidItem = items.find((item) => !item.variableId || item.quantity <= 0 || item.unitCost < 0);
  if (invalidItem) {
    return NextResponse.json({ message: 'Itens de compra inválidos.' }, { status: 400 });
  }

  try {
    updatePurchaseOrder(id, { supplierId, items, purchasedAt });
    return NextResponse.json({ message: 'Compra atualizada com sucesso.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Erro ao atualizar compra.' }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  requireRole(request, ['admin']);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID da compra é obrigatório.' }, { status: 400 });
  }

  try {
    deletePurchaseOrder(id);
    return NextResponse.json({ message: 'Compra excluída com sucesso.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Erro ao excluir compra.' }, { status: 404 });
  }
}

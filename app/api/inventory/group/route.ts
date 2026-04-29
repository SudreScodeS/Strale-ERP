import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { groupData, productData, variableData } from '../../../lib/data';
import { requireRole } from '../../../lib/auth';

const DEFAULT_WATCH_STOCK_ALERT = 30;
const DEFAULT_CRITICAL_STOCK_ALERT = 10;

function normalizeAlertLimits(watchStockAlert?: number, criticalStockAlert?: number) {
  const watch = Number.isFinite(watchStockAlert) ? Math.max(0, Number(watchStockAlert)) : DEFAULT_WATCH_STOCK_ALERT;
  const critical = Number.isFinite(criticalStockAlert) ? Math.max(0, Number(criticalStockAlert)) : DEFAULT_CRITICAL_STOCK_ALERT;

  if (critical > watch) {
    return { error: 'O limite crítico deve ser menor ou igual ao limite de atenção.' as const };
  }

  return { watchStockAlert: watch, criticalStockAlert: critical };
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const body = await request.json();
  const { productId, name, watchStockAlert, criticalStockAlert } = body as {
    productId: string;
    name: string;
    watchStockAlert?: number;
    criticalStockAlert?: number;
  };

  if (!productId || !name) {
    return NextResponse.json({ error: 'Produto e nome do grupo são obrigatórios.' }, { status: 400 });
  }

  const limits = normalizeAlertLimits(watchStockAlert, criticalStockAlert);
  if ('error' in limits) {
    return NextResponse.json({ error: limits.error }, { status: 400 });
  }

  groupData.create({
    id: uuidv4(),
    productId,
    name,
    watchStockAlert: limits.watchStockAlert,
    criticalStockAlert: limits.criticalStockAlert,
    createdAt: new Date(),
  });

  return NextResponse.json({ message: 'Grupo criado com sucesso.' });
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const body = await request.json();
  const { id, productId, name, watchStockAlert, criticalStockAlert } = body as {
    id: string;
    productId?: string;
    name?: string;
    watchStockAlert?: number;
    criticalStockAlert?: number;
  };

  if (!id) {
    return NextResponse.json({ error: 'ID do grupo é obrigatório.' }, { status: 400 });
  }

  const existing = groupData.getAll().find((group) => group.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404 });
  }

  if (productId && !productData.getById(productId)) {
    return NextResponse.json({ error: 'Produto vinculado não encontrado.' }, { status: 404 });
  }

  const updates: { productId?: string; name?: string; watchStockAlert?: number; criticalStockAlert?: number } = {};
  if (productId) updates.productId = productId;
  if (name) updates.name = name;
  if (watchStockAlert !== undefined || criticalStockAlert !== undefined) {
    const limits = normalizeAlertLimits(
      watchStockAlert ?? existing.watchStockAlert,
      criticalStockAlert ?? existing.criticalStockAlert,
    );
    if ('error' in limits) {
      return NextResponse.json({ error: limits.error }, { status: 400 });
    }
    updates.watchStockAlert = limits.watchStockAlert;
    updates.criticalStockAlert = limits.criticalStockAlert;
  }
  groupData.update(id, updates);

  return NextResponse.json({ message: 'Grupo atualizado com sucesso.' });
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID do grupo é obrigatório.' }, { status: 400 });
  }

  const existing = groupData.getAll().find((group) => group.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404 });
  }

  const variables = variableData.getByGroupId(id);
  variables.forEach((variable) => variableData.delete(variable.id));
  groupData.delete(id);

  return NextResponse.json({ message: 'Grupo excluído com sucesso.' });
}

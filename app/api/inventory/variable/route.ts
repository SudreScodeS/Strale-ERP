import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { groupData, variableData, priceHistoryData } from '../../../lib/data';
import { requireRole } from '../../../lib/auth';
import type { UnitOfMeasure } from '../../../../types';

const VALID_UNITS: UnitOfMeasure[] = ['un', 'cm²', 'm²', 'kg', 'g', 'l', 'ml', 'm', 'cm'];

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const body = await request.json();
  const { groupId, name, additionalPrice, stock, unitOfMeasure } = body as { groupId: string; name: string; additionalPrice: number; stock: number; unitOfMeasure?: string };

  if (!groupId || !name || typeof additionalPrice !== 'number' || typeof stock !== 'number') {
    return NextResponse.json({ message: 'Grupo, nome, preço adicional e estoque são obrigatórios.' }, { status: 400 });
  }

  // Validate unit of measure
  const unit: UnitOfMeasure = (unitOfMeasure && VALID_UNITS.includes(unitOfMeasure as UnitOfMeasure))
    ? unitOfMeasure as UnitOfMeasure
    : 'un';

  variableData.create({
    id: uuidv4(),
    groupId,
    name,
    additionalPrice,
    stock,
    unitOfMeasure: unit,
    createdAt: new Date(),
  });

  return NextResponse.json({ message: 'Variável de estoque criada com sucesso.' });
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const body = await request.json();
  const { id, groupId, name, additionalPrice, stock, unitOfMeasure } = body as {
    id: string;
    groupId?: string;
    name?: string;
    additionalPrice?: number;
    stock?: number;
    unitOfMeasure?: string;
  };

  if (!id) {
    return NextResponse.json({ message: 'ID da variável é obrigatório.' }, { status: 400 });
  }

  const existing = variableData.getAll().find((variable) => variable.id === id);
  if (!existing) {
    return NextResponse.json({ message: 'Variável não encontrada.' }, { status: 404 });
  }

  if (groupId && !groupData.getAll().find((group) => group.id === groupId)) {
    return NextResponse.json({ message: 'Grupo vinculado não encontrado.' }, { status: 404 });
  }

  const updates: { groupId?: string; name?: string; additionalPrice?: number; stock?: number; unitOfMeasure?: UnitOfMeasure } = {};
  if (groupId) updates.groupId = groupId;
  if (name) updates.name = name;
  if (typeof additionalPrice === 'number') updates.additionalPrice = additionalPrice;
  if (typeof stock === 'number') updates.stock = stock;
  if (unitOfMeasure && VALID_UNITS.includes(unitOfMeasure as UnitOfMeasure)) {
    updates.unitOfMeasure = unitOfMeasure as UnitOfMeasure;
  }

  // Registra mudança de preço no histórico
  if (typeof additionalPrice === 'number' && additionalPrice !== existing.additionalPrice) {
    priceHistoryData.create({
      id: uuidv4(),
      entityType: 'variable',
      entityId: id,
      oldPrice: existing.additionalPrice,
      newPrice: additionalPrice,
      changedBy: 'admin',
      reason: 'Atualização via API',
      createdAt: new Date(),
    });
  }

  variableData.update(id, updates);

  return NextResponse.json({ message: 'Variável atualizada com sucesso.' });
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ message: 'ID da variável é obrigatório.' }, { status: 400 });
  }

  const existing = variableData.getAll().find((variable) => variable.id === id);
  if (!existing) {
    return NextResponse.json({ message: 'Variável não encontrada.' }, { status: 404 });
  }

  variableData.delete(id);
  return NextResponse.json({ message: 'Variável excluída com sucesso.' });
}

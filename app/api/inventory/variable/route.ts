import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { groupData, variableData } from '../../../lib/data';
import { requireRole } from '../../../lib/auth';

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
  const { groupId, name, additionalPrice, stock } = body as { groupId: string; name: string; additionalPrice: number; stock: number };

  if (!groupId || !name || typeof additionalPrice !== 'number' || typeof stock !== 'number') {
    return NextResponse.json({ error: 'Grupo, nome, preço adicional e estoque são obrigatórios.' }, { status: 400 });
  }

  variableData.create({
    id: uuidv4(),
    groupId,
    name,
    additionalPrice,
    stock,
    createdAt: new Date(),
  });

  return NextResponse.json({ message: 'Variável de estoque criada com sucesso.' });
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
  const { id, groupId, name, additionalPrice, stock } = body as {
    id: string;
    groupId?: string;
    name?: string;
    additionalPrice?: number;
    stock?: number;
  };

  if (!id) {
    return NextResponse.json({ error: 'ID da variável é obrigatório.' }, { status: 400 });
  }

  const existing = variableData.getAll().find((variable) => variable.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'Variável não encontrada.' }, { status: 404 });
  }

  if (groupId && !groupData.getAll().find((group) => group.id === groupId)) {
    return NextResponse.json({ error: 'Grupo vinculado não encontrado.' }, { status: 404 });
  }

  const updates: { groupId?: string; name?: string; additionalPrice?: number; stock?: number } = {};
  if (groupId) updates.groupId = groupId;
  if (name) updates.name = name;
  if (typeof additionalPrice === 'number') updates.additionalPrice = additionalPrice;
  if (typeof stock === 'number') updates.stock = stock;
  variableData.update(id, updates);

  return NextResponse.json({ message: 'Variável atualizada com sucesso.' });
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
    return NextResponse.json({ error: 'ID da variável é obrigatório.' }, { status: 400 });
  }

  const existing = variableData.getAll().find((variable) => variable.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'Variável não encontrada.' }, { status: 404 });
  }

  variableData.delete(id);
  return NextResponse.json({ message: 'Variável excluída com sucesso.' });
}

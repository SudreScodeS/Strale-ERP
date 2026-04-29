import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { groupData, productData, variableData } from '../../../lib/data';
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
  const { name, basePrice, description, imageUrl } = body as {
    name: string;
    basePrice: number;
    description?: string;
    imageUrl?: string;
  };

  if (!name || typeof basePrice !== 'number' || !imageUrl) {
    return NextResponse.json({ error: 'Nome, preço base e imagem são obrigatórios.' }, { status: 400 });
  }

  productData.create({
    id: uuidv4(),
    name,
    basePrice,
    description: description || '',
    imageUrl,
    createdAt: new Date(),
  });

  return NextResponse.json({ message: 'Produto criado com sucesso.' });
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
  const { id, name, basePrice, description, imageUrl } = body as {
    id: string;
    name?: string;
    basePrice?: number;
    description?: string;
    imageUrl?: string;
  };

  if (!id) {
    return NextResponse.json({ error: 'ID do produto é obrigatório.' }, { status: 400 });
  }

  const existing = productData.getById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
  }

  const updates: { name?: string; basePrice?: number; description?: string; imageUrl?: string } = {};
  if (name) updates.name = name;
  if (typeof basePrice === 'number') updates.basePrice = basePrice;
  if (typeof description === 'string') updates.description = description;
  if (typeof imageUrl === 'string') updates.imageUrl = imageUrl;

  productData.update(id, updates);
  return NextResponse.json({ message: 'Produto atualizado com sucesso.' });
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
    return NextResponse.json({ error: 'ID do produto é obrigatório.' }, { status: 400 });
  }

  const existing = productData.getById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
  }

  const groups = groupData.getByProductId(id);
  for (const group of groups) {
    const variables = variableData.getByGroupId(group.id);
    variables.forEach((variable) => variableData.delete(variable.id));
    groupData.delete(group.id);
  }
  productData.delete(id);

  return NextResponse.json({ message: 'Produto excluído com sucesso.' });
}

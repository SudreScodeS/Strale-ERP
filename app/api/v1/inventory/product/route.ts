// api/v1/inventory/product/route.ts
// V1 standardized inventory product endpoint.

import { v4 as uuidv4 } from 'uuid';
import { groupData, productData, variableData, priceHistoryData } from '../../../../lib/data';
import { requireRole } from '../../../../lib/auth';
import { ok, created, badRequest, notFound, fromError } from '../../../../lib/api-response';

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { name, basePrice, description, imageUrl, profitMargin } = body as {
      name: string; basePrice: number; description?: string; imageUrl?: string; profitMargin?: number;
    };

    if (!name || typeof basePrice !== 'number' || !imageUrl) return badRequest('Nome, preço base e imagem são obrigatórios.');

    productData.create({
      id: uuidv4(), name, basePrice,
      profitMargin: typeof profitMargin === 'number' ? profitMargin : undefined,
      description: description || '', imageUrl, createdAt: new Date(),
    });

    return created({ message: 'Produto criado com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { id, name, basePrice, description, imageUrl, profitMargin } = body as {
      id: string; name?: string; basePrice?: number; description?: string; imageUrl?: string; profitMargin?: number;
    };

    if (!id) return badRequest('ID do produto é obrigatório.');
    const existing = productData.getById(id);
    if (!existing) return notFound('Produto não encontrado.');

    const updates: { name?: string; basePrice?: number; description?: string; imageUrl?: string; profitMargin?: number } = {};
    if (name) updates.name = name;
    if (typeof basePrice === 'number') updates.basePrice = basePrice;
    if (typeof description === 'string') updates.description = description;
    if (typeof imageUrl === 'string') updates.imageUrl = imageUrl;
    if (typeof profitMargin === 'number') updates.profitMargin = profitMargin;

    if (typeof basePrice === 'number' && basePrice !== existing.basePrice) {
      priceHistoryData.create({
        id: uuidv4(), entityType: 'product', entityId: id,
        oldPrice: existing.basePrice, newPrice: basePrice,
        changedBy: 'admin', reason: 'Atualização via API', createdAt: new Date(),
      });
    }

    productData.update(id, updates);
    return ok({ message: 'Produto atualizado com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return badRequest('ID do produto é obrigatório.');

    const existing = productData.getById(id);
    if (!existing) return notFound('Produto não encontrado.');

    const groups = groupData.getByProductId(id);
    for (const group of groups) {
      const variables = variableData.getByGroupId(group.id);
      variables.forEach((variable) => variableData.delete(variable.id));
      groupData.delete(group.id);
    }
    productData.delete(id);

    return ok({ message: 'Produto excluído com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

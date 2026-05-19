// api/v1/inventory/variable/route.ts
// V1 standardized inventory variable endpoint.

import { v4 as uuidv4 } from 'uuid';
import { groupData, variableData, priceHistoryData } from '../../../../lib/data';
import { requireRole } from '../../../../lib/auth';
import type { UnitOfMeasure } from '../../../../../types';
import { ok, created, badRequest, notFound, fromError } from '../../../../lib/api-response';

const VALID_UNITS: UnitOfMeasure[] = ['un', 'cm²', 'm²', 'kg', 'g', 'l', 'ml', 'm', 'cm'];

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { groupId, name, additionalPrice, stock, unitOfMeasure } = body as {
      groupId: string; name: string; additionalPrice: number; stock: number; unitOfMeasure?: string;
    };

    if (!groupId || !name || typeof additionalPrice !== 'number' || typeof stock !== 'number') {
      return badRequest('Grupo, nome, preço adicional e estoque são obrigatórios.');
    }

    const unit: UnitOfMeasure = (unitOfMeasure && VALID_UNITS.includes(unitOfMeasure as UnitOfMeasure))
      ? unitOfMeasure as UnitOfMeasure : 'un';

    variableData.create({
      id: uuidv4(), groupId, name, additionalPrice, stock, unitOfMeasure: unit, createdAt: new Date(),
    });

    return created({ message: 'Variável de estoque criada com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { id, groupId, name, additionalPrice, stock, unitOfMeasure } = body as {
      id: string; groupId?: string; name?: string; additionalPrice?: number; stock?: number; unitOfMeasure?: string;
    };

    if (!id) return badRequest('ID da variável é obrigatório.');
    const existing = variableData.getAll().find((variable) => variable.id === id);
    if (!existing) return notFound('Variável não encontrada.');
    if (groupId && !groupData.getAll().find((group) => group.id === groupId)) return notFound('Grupo vinculado não encontrado.');

    const updates: { groupId?: string; name?: string; additionalPrice?: number; stock?: number; unitOfMeasure?: UnitOfMeasure } = {};
    if (groupId) updates.groupId = groupId;
    if (name) updates.name = name;
    if (typeof additionalPrice === 'number') updates.additionalPrice = additionalPrice;
    if (typeof stock === 'number') updates.stock = stock;
    if (unitOfMeasure && VALID_UNITS.includes(unitOfMeasure as UnitOfMeasure)) updates.unitOfMeasure = unitOfMeasure as UnitOfMeasure;

    if (typeof additionalPrice === 'number' && additionalPrice !== existing.additionalPrice) {
      priceHistoryData.create({
        id: uuidv4(), entityType: 'variable', entityId: id,
        oldPrice: existing.additionalPrice, newPrice: additionalPrice,
        changedBy: 'admin', reason: 'Atualização via API', createdAt: new Date(),
      });
    }

    variableData.update(id, updates);
    return ok({ message: 'Variável atualizada com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return badRequest('ID da variável é obrigatório.');

    const existing = variableData.getAll().find((variable) => variable.id === id);
    if (!existing) return notFound('Variável não encontrada.');

    variableData.delete(id);
    return ok({ message: 'Variável excluída com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

// api/v1/suppliers/route.ts
// V1 standardized suppliers endpoint.

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requireRole } from '../../../lib/auth';
import { supplierData } from '../../../lib/data';
import { ok, created, badRequest, notFound, conflict, fromError } from '../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
    return ok({ suppliers: supplierData.getAll() });
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);

    const body = await request.json();
    const { name, contact } = body as { name?: string; contact?: string };

    if (!name?.trim()) {
      return badRequest('Nome do fornecedor é obrigatório.');
    }

    const exists = supplierData
      .getAll()
      .find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return conflict('Fornecedor já cadastrado.');
    }

    const supplier = {
      id: uuidv4(),
      name: name.trim(),
      contact: contact?.trim() || '',
      createdAt: new Date(),
    };

    supplierData.create(supplier);
    return created({ supplier }, 'Fornecedor criado com sucesso.');
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { id, name, contact } = body as { id?: string; name?: string; contact?: string };

    if (!id) return badRequest('ID do fornecedor é obrigatório.');
    const existing = supplierData.getById(id);
    if (!existing) return notFound('Fornecedor não encontrado.');

    const updates: Partial<{ name: string; contact: string }> = {};
    if (name?.trim()) updates.name = name.trim();
    if (contact !== undefined) updates.contact = contact.trim();

    supplierData.update(id, updates);
    const updated = supplierData.getById(id);
    return ok({ supplier: updated || { ...existing, ...updates } });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return badRequest('ID do fornecedor é obrigatório.');
    const existing = supplierData.getById(id);
    if (!existing) return notFound('Fornecedor não encontrado.');

    supplierData.delete(id);
    return ok({ message: 'Fornecedor excluído com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

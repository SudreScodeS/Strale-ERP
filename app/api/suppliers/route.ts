import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requireRole } from '../../lib/auth';
import { supplierData } from '../../lib/data';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  return NextResponse.json({ suppliers: supplierData.getAll() });
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
  const { name, contact } = body as { name?: string; contact?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome do fornecedor é obrigatório.' }, { status: 400 });
  }

  const exists = supplierData
    .getAll()
    .find((supplier) => supplier.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (exists) {
    return NextResponse.json({ error: 'Fornecedor já cadastrado.' }, { status: 409 });
  }

  const supplier = {
    id: uuidv4(),
    name: name.trim(),
    contact: contact?.trim() || '',
    createdAt: new Date(),
  };

  supplierData.create(supplier);
  return NextResponse.json({ message: 'Fornecedor criado com sucesso.', supplier });
}

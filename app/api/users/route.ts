import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { userData } from '../../lib/data';
import { hashPassword, requireRole } from '../../lib/auth';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const users = userData.getAll().map(({ password, ...user }) => user);
  return NextResponse.json({ users });
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
  const { username, email, password, role } = body as {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'seller';
  };

  if (!username || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, { status: 400 });
  }

  if (role && role !== 'admin' && role !== 'seller') {
    return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 });
  }

  const existing = userData.getByUsername(username);
  if (existing) {
    return NextResponse.json({ error: 'Usuário já existe.' }, { status: 409 });
  }

  const hashedPassword = await hashPassword(password);
  const user = {
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    role: role || 'seller',
    createdAt: new Date(),
  };

  userData.create(user);
  const { password: _, ...userWithoutPassword } = user;
  return NextResponse.json({ message: 'Usuário criado com sucesso.', user: userWithoutPassword });
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
  const { id, username, email, password, role } = body as {
    id: string;
    username?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'seller';
  };

  if (!id) {
    return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
  }

  const existing = userData.getById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  if (role && role !== 'admin' && role !== 'seller') {
    return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 });
  }

  if (username && username !== existing.username) {
    const userWithSameName = userData.getByUsername(username);
    if (userWithSameName && userWithSameName.id !== id) {
      return NextResponse.json({ error: 'Nome de usuário já existe.' }, { status: 409 });
    }
  }

  const updates: { username?: string; email?: string; password?: string; role?: 'admin' | 'seller' } = {};
  if (username) updates.username = username;
  if (email) updates.email = email;
  if (role) updates.role = role;
  if (password) {
    updates.password = await hashPassword(password);
  }

  userData.update(id, updates);
  const updated = userData.getById(id);
  if (!updated) {
    return NextResponse.json({ error: 'Falha ao atualizar usuário.' }, { status: 500 });
  }
  const { password: _, ...userWithoutPassword } = updated;
  return NextResponse.json({ message: 'Usuário atualizado com sucesso.', user: userWithoutPassword });
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
    return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
  }

  const existing = userData.getById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 });
  }

  // Prevent deleting the last admin
  if (existing.role === 'admin') {
    const allUsers = userData.getAll();
    const adminCount = allUsers.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Nao e possivel excluir o ultimo administrador. Crie outro admin antes.' }, { status: 400 });
    }
  }

  userData.delete(id);
  return NextResponse.json({ message: 'Usuario excluido com sucesso.' });
}

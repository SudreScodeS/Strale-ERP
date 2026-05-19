// api/v1/users/route.ts
// V1 standardized users endpoint.

import { v4 as uuidv4 } from 'uuid';
import { userData } from '../../../../lib/data';
import { hashPassword, requireRole } from '../../../../lib/auth';
import { ok, created, badRequest, notFound, conflict, forbidden, fromError } from '../../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
    const users = userData.getAll().map(({ password, ...user }) => user);
    return ok({ users });
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { username, email, password, role } = body as {
      username: string; email: string; password: string; role?: 'admin' | 'seller';
    };

    if (!username || !email || !password) return badRequest('Nome, e-mail e senha são obrigatórios.');
    if (role && role !== 'admin' && role !== 'seller') return badRequest('Papel inválido.');

    const existing = userData.getByUsername(username);
    if (existing) return conflict('Usuário já existe.');

    const hashedPassword = await hashPassword(password);
    const user = { id: uuidv4(), username, email, password: hashedPassword, role: role || 'seller', createdAt: new Date() };
    userData.create(user);
    const { password: _, ...userWithoutPassword } = user;
    return created({ user: userWithoutPassword }, 'Usuário criado com sucesso.');
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
    const body = await request.json();
    const { id, username, email, password, role } = body as {
      id: string; username?: string; email?: string; password?: string; role?: 'admin' | 'seller';
    };

    if (!id) return badRequest('ID do usuário é obrigatório.');
    const existing = userData.getById(id);
    if (!existing) return notFound('Usuário não encontrado.');
    if (role && role !== 'admin' && role !== 'seller') return badRequest('Papel inválido.');

    if (username && username !== existing.username) {
      const userWithSameName = userData.getByUsername(username);
      if (userWithSameName && userWithSameName.id !== id) return conflict('Nome de usuário já existe.');
    }

    const updates: { username?: string; email?: string; password?: string; role?: 'admin' | 'seller' } = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (password) updates.password = await hashPassword(password);

    userData.update(id, updates);
    const updated = userData.getById(id);
    if (!updated) return badRequest('Falha ao atualizar usuário.');
    const { password: _, ...userWithoutPassword } = updated;
    return ok({ user: userWithoutPassword }, 'Usuário atualizado com sucesso.');
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return badRequest('ID do usuário é obrigatório.');

    const existing = userData.getById(id);
    if (!existing) return notFound('Usuario nao encontrado.');

    if (existing.role === 'admin') {
      const allUsers = userData.getAll();
      const adminCount = allUsers.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) return badRequest('Nao e possivel excluir o ultimo administrador.');
    }

    userData.delete(id);
    return ok({ message: 'Usuario excluido com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

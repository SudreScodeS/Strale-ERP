// api/v1/auth/register/route.ts
// V1 standardized register endpoint.

import { v4 as uuidv4 } from 'uuid';
import { userData } from '../../../../lib/data';
import { hashPassword, requireRole } from '../../../../lib/auth';
import { created, badRequest, conflict, forbidden, unauthorized, fromError } from '../../../../lib/api-response';

export async function POST(request: Request) {
  try {
    const users = userData.getAll();
    const isBootstrapRegistration = users.length === 0;

    if (!isBootstrapRegistration) {
      try {
        requireRole(request, ['admin']);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('JWT_SECRET')) {
          return badRequest(error.message);
        }
        return forbidden('Cadastro publico desativado. Crie usuarios pelo painel Usuarios com uma conta admin.');
      }
    }

    const body = await request.json();
    const { username, email, password } = body as { username: string; email: string; password: string };

    if (!username || !email || !password) return badRequest('Dados de registro incompletos.');

    const existing = userData.getByUsername(username);
    if (existing) return conflict('Usuário já existe.');

    const hashedPassword = await hashPassword(password);
    userData.create({
      id: uuidv4(), username, email, password: hashedPassword,
      role: isBootstrapRegistration ? 'admin' : 'seller', createdAt: new Date(),
    });

    return created({ message: 'Cadastro realizado com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}

// api/v1/auth/login/route.ts
// V1 standardized login endpoint.

import { authenticate } from '../../../../../lib/auth';
import { ok, badRequest, unauthorized, fromError } from '../../../../../lib/api-response';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body as { username: string; password: string };

    if (!username || !password) return badRequest('Dados de login incompletos.');

    const token = await authenticate(username, password);
    if (!token) return unauthorized('Usuário ou senha incorretos.');

    return ok({ token });
  } catch (error) {
    return fromError(error);
  }
}

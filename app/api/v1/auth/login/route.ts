// api/v1/auth/login/route.ts
// V1 standardized login endpoint.

import { authenticate } from '../../../../lib/auth';
import { ok, badRequest, unauthorized, fromError } from '../../../../lib/api-response';

const SEVEN_DAYS = 7 * 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body as { username: string; password: string };

    if (!username || !password) return badRequest('Dados de login incompletos.');

    const result = await authenticate(username, password);
    if (!result) return unauthorized('Usuário ou senha incorretos.');

    // Set refresh token as HttpOnly, Secure, SameSite cookie
    const response = ok({ token: result.accessToken });
    response.headers.append(
      'Set-Cookie',
      `refresh_token=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SEVEN_DAYS}`,
    );
    return response;
  } catch (error) {
    return fromError(error);
  }
}

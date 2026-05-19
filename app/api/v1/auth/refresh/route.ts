import { refreshAccessToken } from '../../../../lib/auth';
import { ok, unauthorized, fromError } from '../../../../lib/api-response';

export async function POST(request: Request) {
  try {
    // Read refresh token from cookie or body
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMatch = cookieHeader.match(/refresh_token=([^;]+)/);
    const cookieToken = cookieMatch ? cookieMatch[1] : null;

    let refreshToken = cookieToken;
    if (!refreshToken) {
      try {
        const body = await request.json();
        refreshToken = (body as { refreshToken?: string }).refreshToken ?? null;
      } catch {
        // No body
      }
    }

    if (!refreshToken) return unauthorized('Refresh token não fornecido.');

    const result = refreshAccessToken(refreshToken);
    if (!result) return unauthorized('Refresh token inválido ou expirado.');

    // Set new refresh token as HttpOnly cookie
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append(
      'Set-Cookie',
      `refresh_token=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: { token: result.accessToken },
        meta: { timestamp: new Date().toISOString() },
      }),
      { status: 200, headers },
    );
  } catch (error) {
    return fromError(error);
  }
}

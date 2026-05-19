import { revokeRefreshToken } from '../../../../lib/auth';
import { ok, unauthorized, fromError } from '../../../../lib/api-response';

export async function POST(request: Request) {
  try {
    // Read refresh token from cookie
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMatch = cookieHeader.match(/refresh_token=([^;]+)/);
    const refreshToken = cookieMatch ? cookieMatch[1] : null;

    if (refreshToken) {
      // Verify and revoke
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.decode(refreshToken) as { id?: string } | null;
        if (payload?.id) {
          revokeRefreshToken(payload.id);
        }
      } catch {
        // Token may be invalid, still clear cookie
      }
    }

    // Clear the refresh token cookie
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append(
      'Set-Cookie',
      'refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Logout realizado com sucesso.',
        data: null,
        meta: { timestamp: new Date().toISOString() },
      }),
      { status: 200, headers },
    );
  } catch (error) {
    return fromError(error);
  }
}

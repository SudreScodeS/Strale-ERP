// lib/cookie-flag.ts
// Helper para gerar flags de cookie que funcionam tanto em HTTP (dev) quanto HTTPS (produção).
// Em HTTP (localhost), o flag Secure é omitido para que o navegador aceite o cookie.

/**
 * Detecta se a requisição está sendo feita sobre HTTPS.
 * Considera proxy reverso (x-forwarded-proto) e localhost como HTTP.
 */
export function isSecureRequest(request: Request): boolean {
  // Verifica header de proxy reverso (nginx, Cloudflare, Vercel, etc.)
  const proto = request.headers.get('x-forwarded-proto');
  if (proto === 'https') return true;
  if (proto === 'http') return false;

  // Fallback: verifica a URL da requisição
  try {
    const url = new URL(request.url);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Gera a string de flags para Set-Cookie.
 * Secure é incluído apenas em HTTPS.
 * SameSite=Strict para máxima segurança CSRF.
 */
export function getRefreshCookieFlags(request: Request, maxAgeSeconds: number): string {
  const secure = isSecureRequest(request);
  const parts = [
    'HttpOnly',
    'SameSite=Strict',
    `Path=/`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.splice(1, 0, 'Secure');
  return parts.join('; ');
}

/**
 * Gera string para limpar o cookie de refresh (Max-Age=0).
 */
export function getClearCookieFlags(request: Request): string {
  return getRefreshCookieFlags(request, 0);
}

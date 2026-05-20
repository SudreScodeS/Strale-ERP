// proxy.ts
// Security proxy for all /api/v1/* routes.
// Applies: security headers, request ID, rate limiting.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from './app/lib/rate-limit';

function generateRequestId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return 'req_' + Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Rate limit configs ─────────────────────────────────────────

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/v1/auth/login': { limit: 5, windowMs: 60 * 1000 },
  '/api/v1/auth/register': { limit: 3, windowMs: 60 * 1000 },
  '/api/v1/assistant': { limit: 30, windowMs: 60 * 1000 },
};
const DEFAULT_RATE_LIMIT = { limit: 100, windowMs: 60 * 1000 };

// ── Helper ─────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ── Middleware ──────────────────────────────────────────────────

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to /api/v1/* routes
  if (!pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const requestId = generateRequestId();

  // ── Rate limiting ──────────────────────────────────────────
  let rateLimitConfig = DEFAULT_RATE_LIMIT;
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(path)) {
      rateLimitConfig = config;
      break;
    }
  }

  const rlKey = `${ip}:${pathname}`;
  const { allowed, remaining, resetAt } = checkRateLimit(
    rlKey,
    rateLimitConfig.limit,
    rateLimitConfig.windowMs,
  );

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        message: 'Rate limit exceeded. Tente novamente mais tarde.',
        errorCode: 'RATE_LIMITED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rateLimitConfig.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          'X-Request-Id': requestId,
        },
      },
    );
  }

  // ── Build response with security headers ───────────────────
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Access-Control-Allow-Origin', request.nextUrl.origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

  return response;
}

export const config = {
  matcher: ['/api/v1/:path*'],
};

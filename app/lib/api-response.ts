// lib/api-response.ts
// Standardized API response helpers for all v1 endpoints.
// Ensures consistent structure: { success, message?, data?, errorCode?, meta }

import { NextResponse } from 'next/server';
import type { ApiMeta } from '../../types/api.types';

// ── ID generation ──────────────────────────────────────────────

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

// ── Header helpers ─────────────────────────────────────────────

function withHeaders<T>(response: NextResponse<T>, requestId?: string): NextResponse<T> {
  response.headers.set('X-API-Version', '1.0');
  if (requestId) response.headers.set('X-Request-Id', requestId);
  return response;
}

function withErrorHeaders(response: NextResponse, requestId?: string): NextResponse {
  withHeaders(response, requestId);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

// ── Success Responses ──────────────────────────────────────────

/** 200 — Standard success */
export function ok<T>(data: T, message?: string, meta?: Partial<ApiMeta>): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json({
    success: true,
    ...(message && { message }),
    data,
    meta: { timestamp: timestamp(), requestId, ...meta },
  });
  return withHeaders(response, requestId);
}

/** 201 — Resource created */
export function created<T>(data: T, message?: string): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json(
    {
      success: true,
      message: message || 'Recurso criado com sucesso.',
      data,
      meta: { timestamp: timestamp(), requestId },
    },
    { status: 201 },
  );
  return withHeaders(response, requestId);
}

/** 200 — Success with no data payload (actions, deletes) */
export function success(message: string): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json({
    success: true,
    message,
    data: null,
    meta: { timestamp: timestamp(), requestId },
  });
  return withHeaders(response, requestId);
}

// ── Error Responses ────────────────────────────────────────────

/** 400 — Bad request / validation error */
export function badRequest(message: string, details?: Record<string, string[]>): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'BAD_REQUEST',
      ...(details && { details }),
      meta: { timestamp: timestamp(), requestId },
    },
    { status: 400 },
  );
  return withErrorHeaders(response, requestId);
}

/** 401 — Unauthorized */
export function unauthorized(message = 'Não autenticado.'): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'UNAUTHORIZED',
      meta: { timestamp: timestamp(), requestId },
    },
    { status: 401 },
  );
  return withErrorHeaders(response, requestId);
}

/** 403 — Forbidden */
export function forbidden(message = 'Acesso negado.'): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'FORBIDDEN',
      meta: { timestamp: timestamp(), requestId },
    },
    { status: 403 },
  );
  return withErrorHeaders(response, requestId);
}

/** 404 — Not found */
export function notFound(message = 'Recurso não encontrado.'): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'NOT_FOUND',
      meta: { timestamp: timestamp(), requestId },
    },
    { status: 404 },
  );
  return withErrorHeaders(response, requestId);
}

/** 409 — Conflict */
export function conflict(message: string): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'CONFLICT',
      meta: { timestamp: timestamp(), requestId },
    },
    { status: 409 },
  );
  return withErrorHeaders(response, requestId);
}

/** 500 — Internal server error */
export function internalError(message = 'Erro interno do servidor.'): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'INTERNAL_ERROR',
      meta: { timestamp: timestamp(), requestId },
    },
    { status: 500 },
  );
  return withErrorHeaders(response, requestId);
}

/** Convert an unknown catch error into an appropriate API response */
export function fromError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message === 'Forbidden') return forbidden();
    if (error.message === 'Unauthorized') return unauthorized();
    return internalError(error.message);
  }
  return internalError();
}

// ── Paginated Response ─────────────────────────────────────────

/** 200 — Paginated list */
export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): NextResponse {
  const requestId = generateRequestId();
  const response = NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: timestamp(),
      requestId,
      page,
      pageSize,
      total,
    },
  });
  return withHeaders(response, requestId);
}

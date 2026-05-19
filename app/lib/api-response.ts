// lib/api-response.ts
// Standardized API response helpers for all v1 endpoints.
// Ensures consistent structure: { success, message?, data?, errorCode?, meta }

import { NextResponse } from 'next/server';
import type { ApiSuccess, ApiError, ApiMeta } from '../../types/api.types';

// ── ID generation ──────────────────────────────────────────────

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

// ── Success Responses ──────────────────────────────────────────

/** 200 — Standard success */
export function ok<T>(data: T, message?: string, meta?: Partial<ApiMeta>): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({
    success: true,
    ...(message && { message }),
    data,
    meta: { timestamp: timestamp(), requestId: generateRequestId(), ...meta },
  });
}

/** 201 — Resource created */
export function created<T>(data: T, message?: string): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      message: message || 'Recurso criado com sucesso.',
      data,
      meta: { timestamp: timestamp(), requestId: generateRequestId() },
    },
    { status: 201 },
  );
}

/** 200 — Success with no data payload (actions, deletes) */
export function success(message: string): NextResponse<ApiSuccess<null>> {
  return NextResponse.json({
    success: true,
    message,
    data: null,
    meta: { timestamp: timestamp(), requestId: generateRequestId() },
  });
}

// ── Error Responses ────────────────────────────────────────────

/** 400 — Bad request / validation error */
export function badRequest(message: string, details?: Record<string, string[]>): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'BAD_REQUEST',
      ...(details && { details }),
      meta: { timestamp: timestamp(), requestId: generateRequestId() },
    },
    { status: 400 },
  );
}

/** 401 — Unauthorized */
export function unauthorized(message = 'Não autenticado.'): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'UNAUTHORIZED',
      meta: { timestamp: timestamp(), requestId: generateRequestId() },
    },
    { status: 401 },
  );
}

/** 403 — Forbidden */
export function forbidden(message = 'Acesso negado.'): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'FORBIDDEN',
      meta: { timestamp: timestamp(), requestId: generateRequestId() },
    },
    { status: 403 },
  );
}

/** 404 — Not found */
export function notFound(message = 'Recurso não encontrado.'): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'NOT_FOUND',
      meta: { timestamp: timestamp(), requestId: generateRequestId() },
    },
    { status: 404 },
  );
}

/** 409 — Conflict */
export function conflict(message: string): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'CONFLICT',
      meta: { timestamp: timestamp(), requestId: generateRequestId() },
    },
    { status: 409 },
  );
}

/** 500 — Internal server error */
export function internalError(message = 'Erro interno do servidor.'): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      message,
      errorCode: 'INTERNAL_ERROR',
      meta: { timestamp: timestamp(), requestId: generateRequestId() },
    },
    { status: 500 },
  );
}

/** Convert an unknown catch error into an appropriate API response */
export function fromError(error: unknown): NextResponse<ApiError> {
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
): NextResponse<ApiSuccess<T[]>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: timestamp(),
      requestId: generateRequestId(),
      page,
      pageSize,
      total,
    },
  });
}

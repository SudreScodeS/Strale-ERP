"use client";

import type { TokenPayload } from '../../types/auth.types';

export type { TokenPayload };

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('erp-token');
}

export function parseJwt(token: string): TokenPayload | null {
  try {
    const [, segment] = token.split('.');
    if (!segment) return null;
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const json = atob(base64);
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

function isJwtExpired(payload: TokenPayload): boolean {
  if (typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now();
}

export function getCurrentUser() {
  const token = getStoredToken();
  if (!token) return null;
  const payload = parseJwt(token);
  if (!payload) {
    window.localStorage.removeItem('erp-token');
    return null;
  }
  if (isJwtExpired(payload)) {
    window.localStorage.removeItem('erp-token');
    return null;
  }
  return payload;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (!token) return {};
  const payload = parseJwt(token);
  if (!payload || isJwtExpired(payload)) {
    if (typeof window !== 'undefined') window.localStorage.removeItem('erp-token');
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export function logout() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('erp-token');
  window.location.href = '/login';
}

"use client";

import type { TokenPayload } from '../../types/auth.types';

export type { TokenPayload };

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('erp-token');
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('erp-token', token);
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

function isJwtExpiringSoon(payload: TokenPayload, withinMs = 5 * 60 * 1000): boolean {
  if (typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now() + withinMs;
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

/** Refresh the access token using the HttpOnly refresh cookie */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const newToken = json?.data?.token;
    if (newToken) {
      setStoredToken(newToken);
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (!token) return {};
  const payload = parseJwt(token);
  if (!payload || isJwtExpired(payload)) {
    if (typeof window !== 'undefined') window.localStorage.removeItem('erp-token');
    return {};
  }
  // If token is expiring within 5 minutes, trigger async refresh (non-blocking)
  if (isJwtExpiringSoon(payload)) {
    refreshAccessToken().then((newToken) => {
      if (newToken) {
        // Update will take effect on next call to getAuthHeaders
      }
    });
  }
  return { Authorization: `Bearer ${token}` };
}

export async function logout() {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Proceed with local cleanup even if API call fails
  }
  window.localStorage.removeItem('erp-token');
  window.location.href = '/login';
}

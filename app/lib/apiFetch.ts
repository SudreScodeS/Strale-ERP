'use client';

import { getAuthHeaders } from './authClient';
import { toast } from '../components/ui/Toast';
import type { ToastType } from '../components/ui/Toast';

/**
 * Fetch wrapper that automatically shows toast notifications on errors.
 * Use in place of fetch() for API calls.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  } else if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  // Show toast on error responses
  if (!response.ok) {
    try {
      const data = await response.clone().json();
      const message = data.message || getErrorMessage(response.status);
      const type: ToastType = response.status >= 500 ? 'error' : 'warning';
      toast(message, type);
    } catch {
      toast(getErrorMessage(response.status), 'error');
    }
  }

  return response;
}

function getErrorMessage(status: number): string {
  switch (status) {
    case 400: return 'Requisição inválida.';
    case 401: return 'Não autenticado. Faça login novamente.';
    case 403: return 'Acesso negado.';
    case 404: return 'Recurso não encontrado.';
    case 409: return 'Conflito. O recurso já existe.';
    case 429: return 'Muitas requisições. Tente novamente mais tarde.';
    case 500: return 'Erro interno do servidor.';
    default: return `Erro ${status}.`;
  }
}

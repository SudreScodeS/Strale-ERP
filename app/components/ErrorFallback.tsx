'use client';

import { useState } from 'react';

// ==========================================
// ERROR FALLBACK COMPONENT
// User-friendly error boundary UI
// ==========================================

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  /** Context name for the error message */
  context?: string;
}

export function ErrorFallback({ error, resetError, context = 'Esta página' }: ErrorFallbackProps) {
  const [reported, setReported] = useState(false);

  function handleReport() {
    // In a real app, this would send to Sentry or a feedback API
    console.error('[ErrorReport]', { context, error: error?.message, stack: error?.stack });
    setReported(true);
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 rounded-2xl p-10 text-center"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        minHeight: '300px',
      }}
    >
      {/* Animated warning icon */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: 'var(--danger-bg, #fef2f2)',
          color: 'var(--danger, #dc2626)',
        }}
      >
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <div>
        <h3
          className="text-lg font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Algo deu errado
        </h3>
        <p
          className="mt-2 max-w-sm text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {context} não pôde ser carregada. Tente novamente ou entre em contato com o suporte se o problema persistir.
        </p>
      </div>

      {/* Error details (collapsed) */}
      {error?.message && (
        <details
          className="w-full max-w-md rounded-lg px-4 py-3 text-left"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <summary
            className="cursor-pointer text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Detalhes técnicos
          </summary>
          <p
            className="mt-2 break-words font-mono text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            {error.message}
          </p>
        </details>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {resetError && (
          <button
            type="button"
            onClick={resetError}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
            style={{ background: 'var(--brand, #8b5cf6)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Tentar novamente
          </button>
        )}

        <button
          type="button"
          onClick={handleReport}
          disabled={reported}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--surface-muted)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          {reported ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Reportado
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
              Reportar problema
            </>
          )}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (message: string, type: ToastType = 'info') => {
        console.log(`[toast:${type}] ${message}`);
      },
    };
  }
  return ctx;
}

const TOAST_CONFIG: Record<ToastType, { icon: React.ReactNode; accent: string; label: string }> = {
  success: {
    label: 'Sucesso',
    accent: 'var(--success, #34d399)',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    label: 'Erro',
    accent: 'var(--danger, #f87171)',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  warning: {
    label: 'Atenção',
    accent: 'var(--warning, #fbbf24)',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  info: {
    label: 'Info',
    accent: 'var(--info, #818cf8)',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const config = TOAST_CONFIG[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className="flex w-full max-w-md items-start gap-3 rounded-xl p-4 shadow-lg transition-all duration-300"
      style={{
        background: 'var(--card-bg, #131316)',
        border: '1px solid var(--card-border, #232329)',
        borderLeft: `3px solid ${config.accent}`,
        transform: exiting ? 'translateY(-120%)' : 'translateY(0)',
        opacity: exiting ? 0 : 1,
      }}
    >
      <span
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${config.accent} 15%, transparent)`, color: config.accent }}
      >
        {config.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary, #ecedf0)' }}>
          {config.label}
        </p>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted, #71717a)' }}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="flex-shrink-0 rounded-md p-1 transition-colors"
        style={{ color: 'var(--text-faint, #52525b)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-muted, #1f1f24)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function ToastContainerInner({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[300] flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, type, duration }];
      if (next.length > 3) next.shift();
      return next;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {typeof window !== 'undefined' &&
        createPortal(
          <ToastContainerInner toasts={toasts} onRemove={removeToast} />,
          document.body
        )}
    </ToastContext.Provider>
  );
}

let standaloneToast: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

export function setStandaloneToast(fn: typeof standaloneToast) {
  standaloneToast = fn;
}

export function toast(message: string, type: ToastType = 'info', duration = 4000) {
  if (standaloneToast) {
    standaloneToast(message, type, duration);
  } else {
    console.log(`[toast:${type}] ${message}`);
  }
}

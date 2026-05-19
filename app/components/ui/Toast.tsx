'use client';

// ── Toast.tsx — Toast notification system ─

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';

// ── Types ──────────────────────────────────────────────────

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

// ── Context ────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for when used outside provider
    return {
      toast: (message: string, type: ToastType = 'info') => {
        console.log(`[toast:${type}] ${message}`);
      },
    };
  }
  return ctx;
}

// ── Toast Icons ────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: string; bg: string; border: string; text: string }> = {
  success: { icon: '✓', bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success)' },
  error: { icon: '✗', bg: 'var(--danger-bg)', border: 'var(--danger-border)', text: 'var(--danger)' },
  warning: { icon: '!', bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning)' },
  info: { icon: 'i', bg: 'var(--info-bg)', border: 'var(--info-border)', text: 'var(--info)' },
};

// ── Single Toast Component ─────────────────────────────────

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
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg transition-all duration-300"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
        transform: exiting ? 'translateX(120%)' : 'translateX(0)',
        opacity: exiting ? 0 : 1,
      }}
    >
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: config.text, color: '#fff' }}
      >
        {config.icon}
      </span>
      <span className="flex-1 min-w-0">{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="flex-shrink-0 rounded p-0.5 transition-colors hover:opacity-70"
        style={{ color: config.text }}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Toast Container ────────────────────────────────────────

function ToastContainerInner({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col-reverse gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => {
      // Limit to 5 visible toasts
      const next = [...prev, { id, message, type, duration }];
      if (next.length > 5) next.shift();
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

// ── Standalone toast function (for use outside React) ──────

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

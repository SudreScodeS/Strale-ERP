'use client';

import { forwardRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import type { FieldError, FieldErrorsImpl, Merge } from 'react-hook-form';

// ==========================================
// VALIDATED FORM FIELD — Input with validation styling
// ==========================================

type ErrorMessage = string | FieldError | Merge<FieldError, FieldErrorsImpl> | undefined;

/** Safely extract error message as string from react-hook-form error types */
function getErrorMsg(error: ErrorMessage): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  const msg = (error as FieldError).message;
  return typeof msg === 'string' ? msg : undefined;
}

interface ValidatedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: ErrorMessage;
  hint?: string;
  containerClassName?: string;
}

/**
 * Input component with built-in validation styling.
 * Shows red border + error message when invalid.
 * Shows hint text when no error.
 */
export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ label, error, hint, containerClassName = '', className = '', ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const errorMsg = getErrorMsg(error);
    const hasError = touched && !!errorMsg;

    return (
      <label className={`block space-y-1.5 ${containerClassName}`} style={{ color: 'var(--text-secondary)' }}>
        <span className="text-sm font-medium">{label}</span>
        <input
          ref={ref}
          {...props}
          onBlur={(e) => {
            setTouched(true);
            props.onBlur?.(e);
          }}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          style={{
            background: 'var(--input-bg)',
            borderColor: hasError ? 'var(--danger, #dc2626)' : 'var(--input-border)',
            color: 'var(--text-primary)',
            boxShadow: hasError
              ? '0 0 0 3px rgba(220, 38, 38, 0.12)'
              : '0 1px 0 rgba(167, 139, 250, 0.04) inset, 0 -1px 0 rgba(0, 0, 0, 0.08) inset',
          }}
          onFocus={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = 'var(--input-focus)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--input-focus-ring), 0 1px 0 rgba(167, 139, 250, 0.1) inset';
            }
            props.onFocus?.(e);
          }}
          onBlurCapture={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = 'var(--input-border)';
              e.currentTarget.style.boxShadow = '0 1px 0 rgba(167, 139, 250, 0.04) inset, 0 -1px 0 rgba(0, 0, 0, 0.08) inset';
            }
          }}
        />
        {hasError ? (
          <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {errorMsg}
          </p>
        ) : hint ? (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
        ) : null}
      </label>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

// ==========================================
// VALIDATED TEXTAREA
// ==========================================

interface ValidatedTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: ErrorMessage;
  hint?: string;
  containerClassName?: string;
}

export const ValidatedTextarea = forwardRef<HTMLTextAreaElement, ValidatedTextareaProps>(
  ({ label, error, hint, containerClassName = '', className = '', ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const errorMsg = getErrorMsg(error);
    const hasError = touched && !!errorMsg;

    return (
      <label className={`block space-y-1.5 ${containerClassName}`} style={{ color: 'var(--text-secondary)' }}>
        <span className="text-sm font-medium">{label}</span>
        <textarea
          ref={ref}
          {...props}
          onBlur={(e) => {
            setTouched(true);
            props.onBlur?.(e);
          }}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          style={{
            background: 'var(--input-bg)',
            borderColor: hasError ? 'var(--danger, #dc2626)' : 'var(--input-border)',
            color: 'var(--text-primary)',
            boxShadow: hasError
              ? '0 0 0 3px rgba(220, 38, 38, 0.12)'
              : '0 1px 0 rgba(167, 139, 250, 0.04) inset, 0 -1px 0 rgba(0, 0, 0, 0.08) inset',
          }}
          onFocus={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = 'var(--input-focus)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--input-focus-ring), 0 1px 0 rgba(167, 139, 250, 0.1) inset';
            }
          }}
          onBlurCapture={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = 'var(--input-border)';
              e.currentTarget.style.boxShadow = '0 1px 0 rgba(167, 139, 250, 0.04) inset, 0 -1px 0 rgba(0, 0, 0, 0.08) inset';
            }
          }}
        />
        {hasError ? (
          <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {errorMsg}
          </p>
        ) : hint ? (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
        ) : null}
      </label>
    );
  }
);

ValidatedTextarea.displayName = 'ValidatedTextarea';

// ==========================================
// VALIDATED SELECT
// ==========================================

interface ValidatedSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: ErrorMessage;
  hint?: string;
  containerClassName?: string;
}

export const ValidatedSelect = forwardRef<HTMLSelectElement, ValidatedSelectProps>(
  ({ label, error, hint, containerClassName = '', className = '', children, ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const errorMsg = getErrorMsg(error);
    const hasError = touched && !!errorMsg;

    return (
      <label className={`block space-y-1.5 ${containerClassName}`} style={{ color: 'var(--text-secondary)' }}>
        <span className="text-sm font-medium">{label}</span>
        <div className="relative">
          <select
            ref={ref}
            {...props}
            onBlur={(e) => {
              setTouched(true);
              props.onBlur?.(e);
            }}
            className={`w-full appearance-none rounded-xl border px-3 py-2.5 pr-9 text-sm transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            style={{
              background: 'var(--input-bg)',
              borderColor: hasError ? 'var(--danger, #dc2626)' : 'var(--input-border)',
              color: 'var(--text-primary)',
              boxShadow: hasError
                ? '0 0 0 3px rgba(220, 38, 38, 0.12)'
                : '0 1px 0 rgba(167, 139, 250, 0.04) inset, 0 -1px 0 rgba(0, 0, 0, 0.08) inset',
            }}
          >
            {children}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        {hasError ? (
          <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {errorMsg}
          </p>
        ) : hint ? (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
        ) : null}
      </label>
    );
  }
);

ValidatedSelect.displayName = 'ValidatedSelect';

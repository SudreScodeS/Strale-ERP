'use client';

import { useEffect, useState } from 'react';

// ==========================================
// PROGRESS BAR COMPONENT
// ==========================================
// Animated progress indicator for long-running operations.
// Supports determinate (0-100) and indeterminate modes.

interface ProgressBarProps {
  /** Progress percentage (0-100). If null, shows indeterminate animation. */
  value?: number | null;
  /** Optional label shown above the bar */
  label?: string;
  /** Height of the bar */
  height?: number;
  /** Show percentage text */
  showPercent?: boolean;
  /** Additional class names */
  className?: string;
}

export function ProgressBar({ value = null, label, height = 4, showPercent = false, className = '' }: ProgressBarProps) {
  const isIndeterminate = value === null || value === undefined;

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercent) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>}
          {showPercent && !isIndeterminate && (
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {Math.round(value!)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height, background: 'var(--surface-muted, #e2e8f0)' }}
      >
        {isIndeterminate ? (
          <div
            className="h-full animate-progress-indeterminate rounded-full"
            style={{ background: 'var(--brand, #8b5cf6)', width: '40%' }}
          />
        ) : (
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, value))}%`,
              background: `linear-gradient(90deg, var(--brand, #8b5cf6), var(--brand-light, #a78bfa))`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ==========================================
// INLINE PROGRESS — Small inline indicator
// ==========================================

/** Small inline progress for operations within a page (e.g., saving, uploading) */
export function InlineProgress({ message, progress }: { message: string; progress?: number }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: 'var(--brand-muted, #ede9fe)', border: '1px solid var(--brand-border, #c4b5fd)' }}
    >
      <div className="relative h-5 w-5 flex-shrink-0">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--brand, #8b5cf6)' }} />
          <path className="opacity-75" fill="currentColor" style={{ color: 'var(--brand, #8b5cf6)' }} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--brand, #8b5cf6)' }}>{message}</p>
        {progress !== undefined && (
          <div className="mt-1.5">
            <ProgressBar value={progress} height={3} />
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// STEP PROGRESS — Multi-step indicator
// ==========================================

interface Step {
  label: string;
  status: 'pending' | 'active' | 'done';
}

export function StepProgress({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all"
              style={{
                background: step.status === 'done' ? 'var(--success, #16a34a)' : step.status === 'active' ? 'var(--brand, #8b5cf6)' : 'var(--surface-muted, #e2e8f0)',
                color: step.status === 'pending' ? 'var(--text-muted)' : '#fff',
              }}
            >
              {step.status === 'done' ? '✓' : i + 1}
            </div>
            <span
              className="text-xs font-medium"
              style={{
                color: step.status === 'active' ? 'var(--brand, #8b5cf6)' : step.status === 'done' ? 'var(--success, #16a34a)' : 'var(--text-muted)',
              }}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="mx-1 h-px w-6"
              style={{ background: steps[i + 1].status !== 'pending' ? 'var(--brand, #8b5cf6)' : 'var(--border, #e2e8f0)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

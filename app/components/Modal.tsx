'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Extra class for the inner panel */
  className?: string;
  /** Max width of the modal panel (default: 'max-w-lg') */
  maxWidth?: string;
}

/**
 * Accessible modal dialog.
 * - role="dialog" + aria-modal + aria-labelledby
 * - Focus trap (Tab / Shift+Tab cycles within)
 * - Closes on Escape key
 * - Closes on backdrop click
 * - Animated entrance
 */
export function Modal({ open, onClose, title, children, className = '', maxWidth = 'max-w-lg' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save & restore focus
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the panel after it mounts
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      previousFocusRef.current?.focus();
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [open]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  if (!open) return null;

  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return createPortal(
    <div
      className="modal-overlay animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-content w-full ${maxWidth} rounded-2xl p-6 shadow-2xl animate-fade-in-scale outline-none ${className}`}
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <h3 id={titleId} className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

'use client';

// ── ChatInput.tsx — Input with send button and stop capability ─

import { useRef, useEffect, type KeyboardEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSend, onStop, isLoading, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) onSend();
    }
    if (e.key === 'Escape' && isLoading && onStop) {
      onStop();
    }
  }

  return (
    <div className="mt-4 flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Digite sua pergunta..."
        disabled={disabled || isLoading}
        className="flex-1 rounded-xl px-4 py-3 text-sm transition-all disabled:opacity-50"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          color: 'var(--text-primary)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--input-focus)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--input-focus-ring)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--input-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {isLoading ? (
        <button
          onClick={onStop}
          className="rounded-xl px-5 py-3 text-sm font-semibold transition-all"
          style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}
        >
          Parar
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--brand)' }}
        >
          Enviar
        </button>
      )}
    </div>
  );
}

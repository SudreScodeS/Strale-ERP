'use client';

// ── SuggestionChips.tsx — Clickable suggestion chips ─

import React from 'react';

interface SuggestionChipsProps {
  suggestions: Array<{ label: string; icon: React.ReactNode }>;
  onSelect: (label: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.label.toLowerCase())}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all disabled:opacity-50"
          style={{
            background: 'var(--surface-muted)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--brand)';
            e.currentTarget.style.color = 'var(--brand)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <span className="flex-shrink-0">{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

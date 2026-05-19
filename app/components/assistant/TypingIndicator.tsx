'use client';

// ── TypingIndicator.tsx — Animated typing indicator ─

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div
        className="rounded-2xl rounded-bl-md px-4 py-3"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full animate-bounce"
            style={{ background: 'var(--brand)', animationDelay: '0ms', animationDuration: '1.4s' }}
          />
          <span
            className="h-2 w-2 rounded-full animate-bounce"
            style={{ background: 'var(--brand)', animationDelay: '200ms', animationDuration: '1.4s' }}
          />
          <span
            className="h-2 w-2 rounded-full animate-bounce"
            style={{ background: 'var(--brand)', animationDelay: '400ms', animationDuration: '1.4s' }}
          />
        </div>
      </div>
    </div>
  );
}

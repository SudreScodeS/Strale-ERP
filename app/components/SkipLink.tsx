'use client';

/**
 * "Skip to main content" link — only visible when focused via keyboard.
 * Place at the very top of the page, before any navigation.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-4 z-[200] -translate-y-full rounded-xl px-4 py-2 text-sm font-semibold shadow-lg transition-transform focus:translate-y-0"
      style={{
        background: 'var(--brand)',
        color: '#ffffff',
      }}
    >
      Pular para o conteúdo principal
    </a>
  );
}

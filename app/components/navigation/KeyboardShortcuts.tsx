'use client';

// ── KeyboardShortcuts.tsx — Global keyboard shortcut handler ─

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface KeyboardShortcutsProps {
  onTogglePalette: () => void;
  onToggleSidebar?: () => void;
}

const PAGE_SHORTCUTS: Record<string, string> = {
  '1': '/',
  '2': '/sales',
  '3': '/quotes',
  '4': '/inventory',
  '5': '/finance',
  '6': '/assistant',
};

export function KeyboardShortcuts({ onTogglePalette, onToggleSidebar }: KeyboardShortcutsProps) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger in inputs, textareas, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+K / Cmd+K → Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onTogglePalette();
        return;
      }

      // Ctrl+B → Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // Alt+1-6 → Quick page navigation
      if (e.altKey && PAGE_SHORTCUTS[e.key]) {
        e.preventDefault();
        router.push(PAGE_SHORTCUTS[e.key]);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePalette, onToggleSidebar, router]);

  return null;
}

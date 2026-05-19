'use client';

// ── NavigationProvider.tsx — Client wrapper for navigation components ─

import { useState, useCallback } from 'react';
import { Breadcrumbs } from './navigation/Breadcrumbs';
import { CommandPalette } from './navigation/CommandPalette';
import { KeyboardShortcuts } from './navigation/KeyboardShortcuts';
import { ToastProvider } from './ui/Toast';

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const togglePalette = useCallback(() => {
    setPaletteOpen(prev => !prev);
  }, []);

  const toggleSidebar = useCallback(() => {
    // Dispatch custom event that the Sidebar listens to
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  }, []);

  return (
    <ToastProvider>
      <KeyboardShortcuts onTogglePalette={togglePalette} onToggleSidebar={toggleSidebar} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {children}
    </ToastProvider>
  );
}

export { Breadcrumbs };

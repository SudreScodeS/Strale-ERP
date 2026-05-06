'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getCurrentUser } from '../lib/authClient';

// ==========================================
// TYPES
// ==========================================

export interface SectionConfig {
  id: string;
  visible: boolean;
  order: number;
  colSpan: 1 | 2; // 1 = half width, 2 = full width
}

export interface PageLayout {
  sections: SectionConfig[];
}

export type UserLayouts = Record<string, PageLayout>; // keyed by page path

interface LayoutContextValue {
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  getPageLayout: (pagePath: string, defaultSections: SectionConfig[]) => SectionConfig[];
  updateSection: (pagePath: string, sectionId: string, updates: Partial<SectionConfig>) => void;
  resetPageLayout: (pagePath: string) => void;
  reorderSections: (pagePath: string, fromIndex: number, toIndex: number) => void;
}

// ==========================================
// CONTEXT
// ==========================================

const LayoutContext = createContext<LayoutContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'strale-layout-';

function getStorageKey(): string {
  if (typeof window === 'undefined') return `${STORAGE_KEY_PREFIX}default`;
  const user = getCurrentUser();
  return `${STORAGE_KEY_PREFIX}${user?.id || 'default'}`;
}

function loadLayouts(): UserLayouts {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLayouts(layouts: UserLayouts) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(layouts));
  } catch {
    // storage full or unavailable
  }
}

// ==========================================
// PROVIDER
// ==========================================

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [layouts, setLayouts] = useState<UserLayouts>({});
  const currentSectionsRef = useRef<Record<string, SectionConfig[]>>({});

  // Load from localStorage on mount
  useEffect(() => {
    setLayouts(loadLayouts());
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (Object.keys(layouts).length > 0) {
      saveLayouts(layouts);
    }
  }, [layouts]);

  const getPageLayout = useCallback(
    (pagePath: string, defaultSections: SectionConfig[]): SectionConfig[] => {
      const saved = layouts[pagePath];
      let result: SectionConfig[];
      if (!saved) {
        result = defaultSections;
      } else {
        // Merge saved with defaults (new sections get added, removed ones get dropped)
        const savedMap = new Map(saved.sections.map((s) => [s.id, s]));
        const merged = defaultSections.map((def) => {
          const s = savedMap.get(def.id);
          return s ? { ...def, visible: s.visible, order: s.order, colSpan: s.colSpan } : def;
        });
        // Sort by order
        result = merged.sort((a, b) => a.order - b.order);
      }
      // Store current sections for reorderSections to use
      currentSectionsRef.current[pagePath] = result;
      return result;
    },
    [layouts],
  );

  const updateSection = useCallback(
    (pagePath: string, sectionId: string, updates: Partial<SectionConfig>) => {
      setLayouts((prev) => {
        const current = prev[pagePath]?.sections || [];
        const exists = current.some((s) => s.id === sectionId);
        const next = exists
          ? current.map((s) => (s.id === sectionId ? { ...s, ...updates } : s))
          : [...current, { id: sectionId, visible: true, order: current.length, colSpan: 1 as const, ...updates }];
        return { ...prev, [pagePath]: { sections: next } };
      });
    },
    [],
  );

  const reorderSections = useCallback((pagePath: string, fromIndex: number, toIndex: number) => {
    setLayouts((prev) => {
      // Use saved sections if they exist, otherwise use current sections from getPageLayout
      const saved = prev[pagePath]?.sections;
      const base = (saved && saved.length > 0)
        ? [...saved]
        : [...(currentSectionsRef.current[pagePath] || [])];
      if (base.length === 0) return prev;
      const [moved] = base.splice(fromIndex, 1);
      base.splice(toIndex, 0, moved);
      const reordered = base.map((s, i) => ({ ...s, order: i }));
      return { ...prev, [pagePath]: { sections: reordered } };
    });
  }, []);

  const resetPageLayout = useCallback((pagePath: string) => {
    setLayouts((prev) => {
      const next = { ...prev };
      delete next[pagePath];
      return next;
    });
  }, []);

  return (
    <LayoutContext.Provider
      value={{ isEditing, setIsEditing, getPageLayout, updateSection, resetPageLayout, reorderSections }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

// ==========================================
// HOOK
// ==========================================

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}

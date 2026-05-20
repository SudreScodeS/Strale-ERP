'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { locales, defaultLocale, type Locale } from './config';
import { getDictionary, type Dictionary } from './index';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: Dictionary | null;
  loading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('erp-locale') as Locale | null;
    const initial = stored && locales.includes(stored) ? stored : defaultLocale;
    setLocaleState(initial);
    getDictionary(initial).then((d) => { setDict(d); setLoading(false); });
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('erp-locale', newLocale);
    setLoading(true);
    getDictionary(newLocale).then((d) => { setDict(d); setLoading(false); });
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    if (!dict) return key;
    let value = getNestedValue(dict as Record<string, unknown>, key);
    if (value === undefined) return key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  }, [dict]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dict, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

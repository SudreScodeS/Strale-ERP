import type { Locale } from './config';

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

const dictionaries = {
  'pt-BR': () => import('./dictionaries/pt-BR.json').then(m => m.default),
  'en-US': () => import('./dictionaries/en-US.json').then(m => m.default),
};

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}

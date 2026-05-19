'use client';

import { useEffect } from 'react';

/**
 * Sets document.title for client components that can't export metadata.
 * Render this at the top of any `'use client'` page.
 */
export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | Elitium ERP`;
  }, [title]);
  return null;
}

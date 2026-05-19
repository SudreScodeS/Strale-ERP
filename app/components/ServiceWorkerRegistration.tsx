'use client';

import { useEffect } from 'react';
import { isServiceWorkerSupported, isNotificationSupported } from '../lib/notifications';

/**
 * Registers the service worker on mount.
 * Renders nothing — just a side-effect component.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register service worker for PWA + notifications
    if (isServiceWorkerSupported()) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[SW] Registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    }
  }, []);

  return null;
}

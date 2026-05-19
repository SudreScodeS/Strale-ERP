'use client';

// ==========================================
// NOTIFICATION MANAGER
// Browser Notification API + Service Worker registration
// ==========================================

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Check if the Notification API is available in this browser
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Check if Service Workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from the user
 * Returns the permission state after the user responds
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn('[Notifications] API not supported in this browser');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    console.warn('[Notifications] Permission was previously denied');
    return 'denied';
  }

  const result = await Notification.requestPermission();
  return result;
}

/**
 * Register the service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.warn('[Notifications] Service Workers not supported');
    return null;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[Notifications] Service Worker registered');
    return swRegistration;
  } catch (error) {
    console.error('[Notifications] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Get the active service worker registration
 */
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

/**
 * Send a local browser notification (no server push needed)
 * Uses the Notification API directly
 */
export function sendLocalNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported()) {
    console.warn('[Notifications] Cannot send — API not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('[Notifications] Cannot send — permission not granted');
    return;
  }

  const notification = new Notification(payload.title, {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    tag: payload.tag || 'elitium-notification',
    data: payload.url || '/',
  });

  notification.onclick = () => {
    window.focus();
    if (payload.url) {
      window.location.href = payload.url;
    }
    notification.close();
  };
}

/**
 * Send notification via Service Worker (works even when page is in background)
 */
export async function sendServiceWorkerNotification(payload: NotificationPayload): Promise<void> {
  const registration = swRegistration || await registerServiceWorker();

  if (!registration) {
    // Fallback to local notification
    sendLocalNotification(payload);
    return;
  }

  if (registration.active) {
    registration.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload,
    });
  } else {
    // Fallback
    sendLocalNotification(payload);
  }
}

/**
 * Initialize the notification system:
 * 1. Register service worker
 * 2. Check existing permission
 */
export async function initNotifications(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  swRegistered: boolean;
}> {
  const supported = isNotificationSupported();
  let permission: NotificationPermission = 'denied';
  let swRegistered = false;

  if (supported) {
    permission = Notification.permission;
  }

  if (isServiceWorkerSupported()) {
    const reg = await registerServiceWorker();
    swRegistered = !!reg;
  }

  return { supported, permission, swRegistered };
}

/**
 * Check if the user has enabled notifications in their preferences
 * Reads from localStorage
 */
export function areNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('erp-notifications-enabled') === 'true';
}

/**
 * Save the user's notification preference
 */
export function setNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('erp-notifications-enabled', String(enabled));
}

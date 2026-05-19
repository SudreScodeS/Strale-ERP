'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconBell } from './icons';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  areNotificationsEnabled,
  setNotificationsEnabled,
  initNotifications,
} from '../lib/notifications';
import { getAuthHeaders } from '../lib/authClient';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  url?: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Initialize
  useEffect(() => {
    setMounted(true);
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
    initNotifications();
  }, []);

  // Fetch notifications — only keep unread ones
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/activity-logs?limit=20', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.logs) {
        const lastRead = localStorage.getItem('erp-notifications-last-read');
        const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;

        const unread: NotificationItem[] = data.logs
          .filter((log: { timestamp: string }) => new Date(log.timestamp).getTime() > lastReadTime)
          .map((log: { id: string; description: string; username: string; timestamp: string; entity?: string }) => ({
            id: log.id,
            title: log.username,
            body: log.description,
            timestamp: log.timestamp,
            url: getNotificationUrl(log.entity),
          }));

        setNotifications(unread);
        setUnreadCount(unread.length);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click — must click OUTSIDE both bell and dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ignore clicks on the bell button itself (toggle handles that)
      if (bellRef.current?.contains(target)) return;
      // Ignore clicks inside the dropdown portal
      if (portalRef.current?.contains(target)) return;
      // Everything else = outside → close
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // "Enable notifications" prompt
  useEffect(() => {
    if (
      mounted &&
      isNotificationSupported() &&
      permission === 'default' &&
      !areNotificationsEnabled() &&
      !sessionStorage.getItem('notif-prompt-dismissed')
    ) {
      setShowPrompt(true);
    }
  }, [mounted, permission]);

  function getNotificationUrl(entity?: string): string {
    switch (entity) {
      case 'order': return '/sales';
      case 'quote': return '/quotes';
      case 'product': return '/inventory';
      case 'purchase': return '/purchases';
      case 'invoice': return '/finance';
      default: return '/notifications';
    }
  }

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      setNotificationsEnabled(true);
    }
    setShowPrompt(false);
  }

  function handleDismissPrompt() {
    sessionStorage.setItem('notif-prompt-dismissed', '1');
    setShowPrompt(false);
  }

  function handleMarkAllRead() {
    const now = new Date().toISOString();
    localStorage.setItem('erp-notifications-last-read', now);
    setNotifications([]);
    setUnreadCount(0);
    setIsOpen(false);
  }

  function handleNotificationClick(url?: string) {
    // Mark as read
    const now = new Date().toISOString();
    localStorage.setItem('erp-notifications-last-read', now);
    setNotifications([]);
    setUnreadCount(0);
    setIsOpen(false);
    if (url) {
      window.location.href = url;
    }
  }

  function formatTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  if (!mounted) return null;

  return (
    <>
      {/* Bell Button */}
      <button
        ref={bellRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200"
        style={{
          color: 'var(--text-muted)',
          background: isOpen ? 'var(--surface-muted)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'var(--surface-muted)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'transparent';
        }}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <IconBell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ background: 'var(--danger, #ef4444)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Enable Notifications Prompt */}
      {showPrompt && createPortal(
        <div
          className="fixed inset-0 z-[99] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={handleDismissPrompt}
        >
          <div
            className="w-72 rounded-xl p-4 shadow-lg"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--brand-border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}
              >
                <IconBell size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Ativar notificações?
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Receba alertas sobre pedidos, estoque e orçamentos.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--brand)' }}
              >
                Ativar
              </button>
              <button
                type="button"
                onClick={handleDismissPrompt}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Dropdown */}
      {isOpen && createPortal(
        <div
          ref={portalRef}
          className="fixed right-4 top-14 z-[100] w-80 overflow-hidden rounded-xl shadow-xl"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Notificações
            </h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              aria-label="Fechar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-faint)' }}
                >
                  <IconBell size={18} />
                </span>
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                  Sem novas notificações
                </p>
              </div>
            ) : (
              notifications.map((notification, i) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification.url)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    className="mt-1.5 flex h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: 'var(--brand)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {notification.body}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-faint)' }}>
                      {formatTime(notification.timestamp)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer — only when there are unread notifications */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-2.5 text-center"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-muted)' }}
            >
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium transition-colors hover:underline"
                style={{ color: 'var(--brand)' }}
              >
                Marcar todas como lidas
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

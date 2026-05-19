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

// ==========================================
// NOTIFICATION BELL COMPONENT
// Dropdown with recent notifications + enable prompt
// ==========================================

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  url?: string;
  read: boolean;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    setMounted(true);
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
    initNotifications();
  }, []);

  // Fetch recent notifications from activity logs
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/activity-logs?limit=10', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.logs) {
        const items: NotificationItem[] = data.logs.map((log: { id: string; description: string; username: string; timestamp: string; entity?: string }) => ({
          id: log.id,
          title: log.username,
          body: log.description,
          timestamp: log.timestamp,
          url: getNotificationUrl(log.entity),
          read: false,
        }));
        setNotifications(items);

        const lastRead = localStorage.getItem('erp-notifications-last-read');
        if (lastRead) {
          const lastReadTime = new Date(lastRead).getTime();
          const unread = items.filter(n => new Date(n.timestamp).getTime() > lastReadTime).length;
          setUnreadCount(unread);
        } else {
          setUnreadCount(items.length);
        }
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Check if we should show the "enable notifications" prompt
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

  function handleMarkAsRead() {
    const now = new Date().toISOString();
    localStorage.setItem('erp-notifications-last-read', now);
    setUnreadCount(0);
  }

  function handleNotificationClick(url?: string) {
    handleMarkAsRead();
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
    <div className="relative" ref={dropdownRef}>
      {/* Enable Notifications Prompt */}
      {showPrompt && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl p-4 shadow-lg"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--brand-border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
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
      )}

      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) handleMarkAsRead();
        }}
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

      {/* Dropdown */}
      {isOpen && createPortal(
        <div
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
            <a
              href="/notifications"
              className="text-xs font-medium transition-colors hover:underline"
              style={{ color: 'var(--brand)' }}
              onClick={() => setIsOpen(false)}
            >
              Ver todas
            </a>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                  Nenhuma notificação
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
                    className="mt-0.5 flex h-2 w-2 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: i < unreadCount ? 'var(--brand)' : 'transparent',
                    }}
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

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-2.5 text-center"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-muted)' }}
            >
              <button
                type="button"
                onClick={() => {
                  handleMarkAsRead();
                  setIsOpen(false);
                  window.location.href = '/notifications';
                }}
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
    </div>
  );
}

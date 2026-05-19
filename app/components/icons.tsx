// components/icons.tsx
// Shared SVG icon components — replaces all emoji usage with clean, consistent icons

import React from 'react';

type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

const s = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

// ─── Action icons (activity log) ───

export function IconCreate({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M12 5v14M5 12h14" /></svg>;
}

export function IconUpdate({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}

export function IconDelete({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>;
}

export function IconConvert({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>;
}

export function IconSend({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
}

export function IconStatusChange({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}

export function IconLogin({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>;
}

export function IconOther({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>;
}

// ─── Notification type icons ───

export function IconCart({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>;
}

export function IconPackage({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
}

export function IconClipboard({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>;
}

export function IconEdit({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}

export function IconAlertTriangle({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}

export function IconShoppingBag({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>;
}

export function IconCheckCircle({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}

export function IconDollarSign({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>;
}

export function IconRestore({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>;
}

// ─── UI icons ───

export function IconSearch({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

export function IconTrash({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>;
}

export function IconX({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

export function IconCheck({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="20 6 9 17 4 12" /></svg>;
}

export function IconCalendar({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}

export function IconBarChart({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>;
}

export function IconTrendingUp({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}

export function IconBell({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>;
}

export function IconFilter({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;
}

export function IconArrowDown({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
}

export function IconArrowUp({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
}

export function IconRefresh({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>;
}

export function IconSort({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /><line x1="4" y1="5" x2="20" y2="5" /></svg>;
}

// ─── Additional icons ───

export function IconTarget({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
}

export function IconSettings({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
}

export function IconTrophy({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0012 0V2z" /></svg>;
}

export function IconFileText({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
}

export function IconRefreshCcw({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" /></svg>;
}

export function IconAlertCircle({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
}

export function IconClock({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}

export function IconMonitor({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
}

export function IconCrosshair({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" /></svg>;
}

export function IconUsers({ size = 16, className, style }: IconProps) {
  return <svg {...s(size)} className={className} style={style}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
}

// ─── Lookup maps for activity log actions ───

export const ACTION_ICON_MAP: Record<string, React.FC<IconProps>> = {
  create: IconCreate,
  update: IconUpdate,
  delete: IconDelete,
  convert: IconConvert,
  send: IconSend,
  status_change: IconStatusChange,
  login: IconLogin,
  restore: IconRestore,
  other: IconOther,
};

export const NOTIFICATION_ICON_MAP: Record<string, React.FC<IconProps>> = {
  orderCreated: IconCart,
  orderStatusChanged: IconStatusChange,
  orderDelivered: IconPackage,
  quoteCreated: IconClipboard,
  quoteStatusChanged: IconEdit,
  stockAlert: IconAlertTriangle,
  purchaseCreated: IconShoppingBag,
  purchaseReceived: IconCheckCircle,
  userLogin: IconLogin,
  financialRecord: IconDollarSign,
};

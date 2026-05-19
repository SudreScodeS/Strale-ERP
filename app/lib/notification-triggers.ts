'use client';

import { sendLocalNotification, areNotificationsEnabled } from './notifications';

// ==========================================
// NOTIFICATION TRIGGERS
// Fire notifications based on ERP events.
// Each function checks user preferences before sending.
// ==========================================

interface OrderLike {
  id: string;
  clientName?: string;
  total?: number;
  status?: string;
  items?: unknown[];
}

interface VariableLike {
  id: string;
  name: string;
  currentStock?: number;
  minimumStock?: number;
}

interface QuoteLike {
  id: string;
  clientName?: string;
  total?: number;
}

// Helper to get notification settings from localStorage
function getSettings(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('erp-notification-settings');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function shouldNotify(key: string): boolean {
  if (!areNotificationsEnabled()) return false;
  const settings = getSettings();
  // If no settings saved, default to true (notify)
  if (Object.keys(settings).length === 0) return true;
  return settings[key] !== false;
}

/**
 * Notify when a new order is created
 */
export function notifyNewOrder(order: OrderLike): void {
  if (!shouldNotify('orderCreated')) return;

  const clientName = order.clientName || 'Cliente';
  const total = order.total
    ? ` — R$ ${order.total.toFixed(2)}`
    : '';

  sendLocalNotification({
    title: '🛒 Novo Pedido',
    body: `Pedido #${order.id.slice(0, 8)} de ${clientName}${total}`,
    url: `/sales?id=${order.id}`,
    tag: `order-${order.id}`,
  });
}

/**
 * Notify when an order status changes
 */
export function notifyOrderStatusChanged(order: OrderLike, oldStatus: string, newStatus: string): void {
  if (!shouldNotify('orderStatusChanged')) return;

  sendLocalNotification({
    title: '📋 Status do Pedido Atualizado',
    body: `Pedido #${order.id.slice(0, 8)}: ${oldStatus} → ${newStatus}`,
    url: `/sales?id=${order.id}`,
    tag: `order-status-${order.id}`,
  });
}

/**
 * Notify when an order is delivered
 */
export function notifyOrderDelivered(order: OrderLike): void {
  if (!shouldNotify('orderDelivered')) return;

  sendLocalNotification({
    title: '📦 Pedido Entregue',
    body: `Pedido #${order.id.slice(0, 8)} foi marcado como entregue!`,
    url: `/sales?id=${order.id}`,
    tag: `order-delivered-${order.id}`,
  });
}

/**
 * Notify for low stock alerts
 */
export function notifyLowStock(variable: VariableLike): void {
  if (!shouldNotify('stockAlert')) return;

  const current = variable.currentStock ?? 0;
  const minimum = variable.minimumStock ?? 0;

  sendLocalNotification({
    title: '⚠️ Estoque Baixo',
    body: `${variable.name}: ${current} unidades (mínimo: ${minimum})`,
    url: '/inventory',
    tag: `stock-${variable.id}`,
  });
}

/**
 * Notify when a quote is approved
 */
export function notifyQuoteApproved(quote: QuoteLike): void {
  if (!shouldNotify('quoteStatusChanged')) return;

  const clientName = quote.clientName || 'Cliente';
  const total = quote.total
    ? ` — R$ ${quote.total.toFixed(2)}`
    : '';

  sendLocalNotification({
    title: '✅ Orçamento Aprovado',
    body: `Orçamento #${quote.id.slice(0, 8)} de ${clientName}${total}`,
    url: `/quotes?id=${quote.id}`,
    tag: `quote-approved-${quote.id}`,
  });
}

/**
 * Notify when a quote is created
 */
export function notifyNewQuote(quote: QuoteLike): void {
  if (!shouldNotify('quoteCreated')) return;

  const clientName = quote.clientName || 'Cliente';

  sendLocalNotification({
    title: '📝 Novo Orçamento',
    body: `Orçamento #${quote.id.slice(0, 8)} para ${clientName}`,
    url: `/quotes?id=${quote.id}`,
    tag: `quote-${quote.id}`,
  });
}

/**
 * Notify when a purchase is created
 */
export function notifyNewPurchase(purchase: { id: string; supplierName?: string; total?: number }): void {
  if (!shouldNotify('purchaseCreated')) return;

  const supplier = purchase.supplierName || 'Fornecedor';

  sendLocalNotification({
    title: '🛍️ Nova Compra Registrada',
    body: `Compra #${purchase.id.slice(0, 8)} — ${supplier}`,
    url: `/purchases?id=${purchase.id}`,
    tag: `purchase-${purchase.id}`,
  });
}

/**
 * Notify when a purchase is received
 */
export function notifyPurchaseReceived(purchase: { id: string; supplierName?: string }): void {
  if (!shouldNotify('purchaseReceived')) return;

  sendLocalNotification({
    title: '✅ Compra Recebida',
    body: `Compra #${purchase.id.slice(0, 8)} de ${purchase.supplierName || 'Fornecedor'} foi recebida`,
    url: `/purchases?id=${purchase.id}`,
    tag: `purchase-received-${purchase.id}`,
  });
}

// lib/purchases.ts
// Regras de consulta e geração para o módulo de pedidos de compra
// Preparado para gerar solicitações de compra a fornecedores

import { v4 as uuidv4 } from 'uuid';
import { financeData, supplierData, variableData, purchaseOrderData, productData, groupData } from './data';

function getPurchaseFinanceDescription(orderId: string) {
  const order = purchaseOrderData.getAll().find((item) => item.id === orderId);
  if (!order) return `Compra ${orderId}`;
  return order.items
    .map((item) => {
      const variable = variableData.getAll().find((entry) => entry.id === item.variableId);
      const itemName = variable?.name || item.variableId;
      return `${itemName} ${item.quantity}x`;
    })
    .join(', ');
}

function getLinkedPurchaseFinanceRecords(orderId: string) {
  const legacyDescription = `Compra registrada (${orderId})`;
  return financeData
    .getAll()
    .filter((record) => record.type === 'purchase' && (record.orderId === orderId || record.description === legacyDescription));
}

export function getPurchaseDashboard() {
  const suppliers = supplierData.getAll();
  const lowStockVariables = variableData.getAll().filter((variable) => variable.stock <= 5);
  const purchaseOrders = purchaseOrderData.getAll();
  const variables = variableData.getAll();
  const products = productData.getAll();
  const groups = groupData.getAll();

  return { suppliers, lowStockVariables, purchaseOrders, variables, products, groups };
}

export function createPurchaseOrder(
  supplierId: string,
  items: { variableId: string; quantity: number; unitCost: number }[],
  purchasedAt?: string,
) {
  const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const purchaseOrder = {
    id: `po-${Date.now()}-${uuidv4().slice(0, 8)}`,
    supplierId,
    items,
    status: 'ordered' as const,
    createdAt: purchasedAt ? new Date(purchasedAt) : new Date(),
  };

  items.forEach((item) => {
    const variable = variableData.getAll().find((entry) => entry.id === item.variableId);
    if (!variable) return;
    variableData.updateStock(variable.id, variable.stock + item.quantity);
  });

  purchaseOrderData.create(purchaseOrder);

  financeData.create({
    id: uuidv4(),
    type: 'purchase',
    amount: totalCost,
    description: getPurchaseFinanceDescription(purchaseOrder.id),
    date: purchasedAt ? new Date(purchasedAt) : new Date(),
    orderId: purchaseOrder.id,
  });

  return purchaseOrder;
}

export function updatePurchaseOrder(
  id: string,
  updates: {
    supplierId: string;
    items: { variableId: string; quantity: number; unitCost: number }[];
    purchasedAt?: string;
  },
) {
  const orders = purchaseOrderData.getAll();
  const existing = orders.find((item) => item.id === id);
  if (!existing) {
    throw new Error('Pedido de compra não encontrado.');
  }

  // Reverte o impacto do pedido antigo no estoque.
  existing.items.forEach((item) => {
    const variable = variableData.getAll().find((entry) => entry.id === item.variableId);
    if (!variable) return;
    variableData.updateStock(variable.id, Math.max(0, variable.stock - item.quantity));
  });

  // Aplica o novo impacto no estoque.
  updates.items.forEach((item) => {
    const variable = variableData.getAll().find((entry) => entry.id === item.variableId);
    if (!variable) return;
    variableData.updateStock(variable.id, variable.stock + item.quantity);
  });

  const nextCreatedAt = updates.purchasedAt ? new Date(updates.purchasedAt) : new Date(existing.createdAt);
  purchaseOrderData.update(id, {
    supplierId: updates.supplierId,
    items: updates.items,
    createdAt: nextCreatedAt,
  });

  const totalCost = updates.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const linkedFinanceRecords = getLinkedPurchaseFinanceRecords(id);
  if (linkedFinanceRecords.length > 0) {
    const [primaryRecord, ...duplicateRecords] = linkedFinanceRecords;
    financeData.update(primaryRecord.id, {
      amount: totalCost,
      date: nextCreatedAt,
      description: getPurchaseFinanceDescription(id),
      orderId: id,
    });
    duplicateRecords.forEach((record) => financeData.delete(record.id));
  } else {
    financeData.create({
      id: uuidv4(),
      type: 'purchase',
      amount: totalCost,
      description: getPurchaseFinanceDescription(id),
      date: nextCreatedAt,
      orderId: id,
    });
  }
}

export function deletePurchaseOrder(id: string) {
  const orders = purchaseOrderData.getAll();
  const existing = orders.find((item) => item.id === id);
  if (!existing) {
    throw new Error('Pedido de compra não encontrado.');
  }

  existing.items.forEach((item) => {
    const variable = variableData.getAll().find((entry) => entry.id === item.variableId);
    if (!variable) return;
    variableData.updateStock(variable.id, Math.max(0, variable.stock - item.quantity));
  });

  const linkedFinanceRecords = getLinkedPurchaseFinanceRecords(id);
  linkedFinanceRecords.forEach((record) => financeData.delete(record.id));

  purchaseOrderData.delete(id);
}

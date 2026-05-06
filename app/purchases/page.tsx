'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

interface SupplierItem {
  id: string;
  name: string;
  contact?: string;
}

interface VariableItem {
  id: string;
  name: string;
  stock: number;
  additionalPrice: number;
}

interface PurchaseOrderItem {
  variableId: string;
  quantity: number;
  unitCost: number;
}

interface PurchaseOrderView {
  id: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  status: 'pending' | 'ordered' | 'received';
  createdAt: string;
}

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [lowStockVariables, setLowStockVariables] = useState<VariableItem[]>([]);
  const [variables, setVariables] = useState<VariableItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderView[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedVariableId, setSelectedVariableId] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [message, setMessage] = useState('');
  const [editingPurchase, setEditingPurchase] = useState<PurchaseOrderView | null>(null);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editVariableId, setEditVariableId] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editUnitCost, setEditUnitCost] = useState(0);
  const [editDate, setEditDate] = useState('');

  const PAGE_PATH = '/purchases';
  const DEFAULT_SECTIONS: SectionConfig[] = [
    { id: 'suppliers', visible: true, order: 0, colSpan: 1 },
    { id: 'purchase-form', visible: true, order: 1, colSpan: 1 },
    { id: 'purchase-history', visible: true, order: 2, colSpan: 2 },
    { id: 'purchase-records', visible: true, order: 3, colSpan: 2 },
  ];
  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      return { error: 'Resposta inválida do servidor.' };
    }
  }

  async function loadDashboard() {
    const response = await fetch('/api/purchases', {
      cache: 'no-store',
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.error || 'Falha ao carregar dados de compras.');
      return;
    }
    setSuppliers(data.suppliers || []);
    setLowStockVariables(data.lowStockVariables || []);
    setVariables(data.variables || []);
    setPurchaseOrders(data.purchaseOrders || []);
    if ((data.suppliers || []).length > 0) setSelectedSupplierId((prev) => prev || data.suppliers[0].id);
    if ((data.variables || []).length > 0) setSelectedVariableId((prev) => prev || data.variables[0].id);
  }

  async function handleCreateSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name: supplierName, contact: supplierContact }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.error || 'Falha ao criar fornecedor.');
      return;
    }
    setMessage(data.message || 'Fornecedor criado com sucesso.');
    setSupplierName('');
    setSupplierContact('');
    setSuppliers((prev) => [data.supplier, ...prev]);
  }

  async function handleCreatePurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        supplierId: selectedSupplierId,
        purchasedAt: purchaseDate || undefined,
        items: [{ variableId: selectedVariableId, quantity: purchaseQuantity, unitCost: purchaseUnitCost }],
      }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.error || 'Falha ao registrar compra.');
      return;
    }
    setMessage(data.message || 'Compra registrada.');
    setPurchaseQuantity(1);
    setPurchaseUnitCost(0);
    await loadDashboard();
  }

  function handleEditPurchase(purchase: PurchaseOrderView) {
    setEditingPurchase(purchase);
    setEditSupplierId(purchase.supplierId);
    setEditVariableId(purchase.items[0]?.variableId || '');
    setEditQuantity(purchase.items[0]?.quantity || 1);
    setEditUnitCost(purchase.items[0]?.unitCost || 0);
    setEditDate(new Date(purchase.createdAt).toISOString().slice(0, 10));
  }

  async function handleSubmitPurchaseUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPurchase) return;
    if (!editSupplierId || !editVariableId || editQuantity <= 0 || editUnitCost < 0) {
      setMessage('Dados inválidos para editar compra.');
      return;
    }

    const response = await fetch('/api/purchases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingPurchase.id,
        supplierId: editSupplierId,
        purchasedAt: editDate,
        items: [{ variableId: editVariableId, quantity: editQuantity, unitCost: editUnitCost }],
      }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.error || 'Falha ao editar compra.');
      return;
    }
    setMessage(data.message || 'Compra atualizada com sucesso.');
    setEditingPurchase(null);
    await loadDashboard();
  }

  async function handleDeletePurchase(purchaseId: string) {
    if (!confirm(`Excluir a compra ${purchaseId}?`)) return;
    const response = await fetch(`/api/purchases?id=${encodeURIComponent(purchaseId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.error || 'Falha ao excluir compra.');
      return;
    }
    setMessage(data.message || 'Compra excluída com sucesso.');
    await loadDashboard();
  }

  const filteredPurchases = purchaseOrders.filter((purchase) => {
    const date = new Date(purchase.createdAt);
    if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && date > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  });

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Pedidos de Compra" description="Gerencie solicitações de compra para fornecedores e atualize o estoque crítico." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {message ? <p className="mb-4 text-sm text-slate-700">{message}</p> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((section, index) => (
            <DraggableSection
              key={`${section.id}-${section.order}`}
              pagePath={PAGE_PATH}
              section={section}
              index={index}
              totalSections={sections.length}
              className={section.colSpan === 2 ? 'lg:col-span-2' : ''}
            >
              {section.id === 'suppliers' && (
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">Estoque crítico</h3>
                  <div className="mt-4 space-y-4">
                    {lowStockVariables.length === 0 ? (
                      <p className="text-sm text-slate-500">Sem itens em estoque crítico no momento.</p>
                    ) : (
                      lowStockVariables.map((item) => (
                        <div key={item.id} className="rounded-3xl border border-slate-200 p-4">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-sm text-slate-600">Estoque: {item.stock}</p>
                          <p className="text-sm text-slate-600">Custo adicional: R$ {item.additionalPrice.toFixed(2)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {section.id === 'purchase-form' && (
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">Fornecedores</h3>
                  <form className="mt-4 grid gap-3 rounded-3xl border border-slate-200 p-4" onSubmit={handleCreateSupplier}>
                    <input
                      value={supplierName}
                      onChange={(event) => setSupplierName(event.target.value)}
                      placeholder="Nome do fornecedor"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                    />
                    <input
                      value={supplierContact}
                      onChange={(event) => setSupplierContact(event.target.value)}
                      placeholder="Contato (telefone, email...)"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                    />
                    <button className="rounded-2xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700" type="submit">
                      Adicionar fornecedor
                    </button>
                  </form>
                  <div className="mt-4 space-y-4">
                    {suppliers.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum fornecedor cadastrado ainda.</p>
                    ) : (
                      suppliers.map((supplier) => (
                        <div key={supplier.id} className="rounded-3xl border border-slate-200 p-4">
                          <p className="font-semibold text-slate-900">{supplier.name}</p>
                          <p className="text-sm text-slate-600">Contato: {supplier.contact || 'Não informado'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {section.id === 'purchase-history' && (
                <section className="rounded-3xl bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">Registrar compra</h3>
                  <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreatePurchase}>
                    <label className="text-slate-700">
                      Fornecedor
                      <select
                        value={selectedSupplierId}
                        onChange={(event) => setSelectedSupplierId(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-slate-700">
                      Item do estoque
                      <select
                        value={selectedVariableId}
                        onChange={(event) => setSelectedVariableId(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        {variables.map((variable) => (
                          <option key={variable.id} value={variable.id}>
                            {variable.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-slate-700">
                      Quantidade comprada
                      <input
                        type="number"
                        min={1}
                        value={purchaseQuantity}
                        onChange={(event) => setPurchaseQuantity(Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      />
                    </label>
                    <label className="text-slate-700">
                      Custo unitário
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={purchaseUnitCost}
                        onChange={(event) => setPurchaseUnitCost(Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      />
                    </label>
                    <label className="text-slate-700">
                      Data da compra
                      <input
                        type="date"
                        value={purchaseDate}
                        onChange={(event) => setPurchaseDate(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      />
                    </label>
                    <div className="flex items-end">
                      <button className="rounded-2xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700" type="submit">
                        Registrar compra
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {section.id === 'purchase-records' && (
                <section className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-end gap-3">
                    <h3 className="text-xl font-semibold text-slate-900">Compras registradas</h3>
                    <label className="text-sm text-slate-600">
                      Data inicial
                      <input
                        type="date"
                        value={fromDate}
                        aria-label="Data inicial das compras"
                        title="Data inicial das compras"
                        onChange={(event) => setFromDate(event.target.value)}
                        className="mt-1 rounded-2xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Data final
                      <input
                        type="date"
                        value={toDate}
                        aria-label="Data final das compras"
                        title="Data final das compras"
                        onChange={(event) => setToDate(event.target.value)}
                        className="mt-1 rounded-2xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                  </div>
                  <div className="mt-4 space-y-3">
                    {filteredPurchases.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhuma compra no período selecionado.</p>
                    ) : (
                      filteredPurchases.map((purchase) => {
                        const supplierNameView = suppliers.find((supplier) => supplier.id === purchase.supplierId)?.name || purchase.supplierId;
                        const total = purchase.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
                        const purchasedItemsLabel = purchase.items
                          .map((item) => {
                            const variable = variables.find((entry) => entry.id === item.variableId);
                            const itemName = variable?.name || item.variableId;
                            return `${itemName} ${item.quantity}x`;
                          })
                          .join(', ');
                        return (
                          <div key={purchase.id} className="rounded-2xl border border-slate-200 p-4">
                            <p className="font-semibold text-slate-900">{purchasedItemsLabel || 'Itens da compra'}</p>
                            <p className="text-sm text-slate-600">Fornecedor: {supplierNameView}</p>
                            <p className="text-sm text-slate-600">Data: {new Date(purchase.createdAt).toLocaleDateString()}</p>
                            <p className="text-sm text-slate-600">Total: R$ {total.toFixed(2)}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleEditPurchase(purchase)}
                                className="rounded-2xl border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeletePurchase(purchase.id)}
                                className="rounded-2xl bg-rose-600 px-3 py-1 text-xs text-white transition hover:bg-rose-700"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}
            </DraggableSection>
          ))}
        </div>

        {editingPurchase ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">Atualizar compra</h3>
              <form className="mt-4 space-y-4" onSubmit={handleSubmitPurchaseUpdate}>
                <label className="block text-slate-700">
                  Fornecedor
                  <select
                    value={editSupplierId}
                    onChange={(event) => setEditSupplierId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-slate-700">
                  Item comprado
                  <select
                    value={editVariableId}
                    onChange={(event) => setEditVariableId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    {variables.map((variable) => (
                      <option key={variable.id} value={variable.id}>
                        {variable.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-slate-700">
                  Quantidade
                  <input
                    type="number"
                    min={1}
                    value={editQuantity}
                    onChange={(event) => setEditQuantity(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Custo unitário
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editUnitCost}
                    onChange={(event) => setEditUnitCost(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Data da compra
                  <input
                    type="date"
                    value={editDate}
                    onChange={(event) => setEditDate(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPurchase(null)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-white">
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </ProtectedPage>
  );
}

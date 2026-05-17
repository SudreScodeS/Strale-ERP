'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Select, Checkbox, FormField, Input } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

// ==========================================
// TYPES
// ==========================================

interface Supplier {
  id: string;
  name: string;
  contact?: string;
}

interface Variable {
  id: string;
  name: string;
  stock: number;
  additionalPrice: number;
  unitOfMeasure?: string;
}

interface PurchaseItem {
  variableId: string;
  quantity: number;
  unitCost: number;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: PurchaseItem[];
  status: 'pending' | 'ordered' | 'received';
  createdAt: string;
}

/** Form state for creating/editing a purchase */
interface PurchaseFormState {
  supplierId: string;
  variableId: string;
  quantity: number;
  unitCost: number;
  date: string;
}

const EMPTY_FORM: PurchaseFormState = {
  supplierId: '',
  variableId: '',
  quantity: 1,
  unitCost: 0,
  date: '',
};

// ==========================================
// PAGE COMPONENT
// ==========================================

export default function PurchasesPage() {
  // ── Data lists ──
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [lowStockVariables, setLowStockVariables] = useState<Variable[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // ── Supplier form ──
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');

  // ── Purchase form (single object instead of 5 separate states) ──
  const [form, setForm] = useState<PurchaseFormState>(EMPTY_FORM);
  const updateForm = (patch: Partial<PurchaseFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  // ── Edit mode ──
  const [editingPurchase, setEditingPurchase] = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm] = useState<PurchaseFormState>(EMPTY_FORM);
  const updateEditForm = (patch: Partial<PurchaseFormState>) => setEditForm((prev) => ({ ...prev, ...patch }));

  // ── Filters ──
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ── Feedback ──
  const [message, setMessage] = useState('');

  // ── Layout ──
  const PAGE_PATH = '/purchases';
  const DEFAULT_SECTIONS: SectionConfig[] = [
    { id: 'suppliers', visible: true, order: 0, colSpan: 1 },
    { id: 'purchase-form', visible: true, order: 1, colSpan: 1 },
    { id: 'purchase-history', visible: true, order: 2, colSpan: 2 },
    { id: 'purchase-records', visible: true, order: 3, colSpan: 2 },
  ];
  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  // ==========================================
  // HELPERS
  // ==========================================

  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      return { error: 'Resposta inválida do servidor.' };
    }
  }

  function findSupplierName(id: string): string {
    return suppliers.find((s) => s.id === id)?.name || id;
  }

  function findVariableName(id: string): string {
    const v = variables.find((v) => v.id === id);
    return v ? `${v.name} (${v.unitOfMeasure || 'un'})` : id;
  }

  // ==========================================
  // DATA LOADING
  // ==========================================

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

    // Auto-select first options if nothing selected
    if (data.suppliers?.length && !form.supplierId) {
      updateForm({ supplierId: data.suppliers[0].id });
    }
    if (data.variables?.length && !form.variableId) {
      updateForm({ variableId: data.variables[0].id });
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  // ==========================================
  // SUPPLIER ACTIONS
  // ==========================================

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

  // ==========================================
  // PURCHASE ACTIONS
  // ==========================================

  async function handleCreatePurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        supplierId: form.supplierId,
        purchasedAt: form.date || undefined,
        items: [{ variableId: form.variableId, quantity: form.quantity, unitCost: form.unitCost }],
      }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.error || 'Falha ao registrar compra.');
      return;
    }
    setMessage(data.message || 'Compra registrada.');
    setForm((prev) => ({ ...prev, quantity: 1, unitCost: 0, date: '' }));
    await loadDashboard();
  }

  function handleEditPurchase(purchase: PurchaseOrder) {
    setEditingPurchase(purchase);
    setEditForm({
      supplierId: purchase.supplierId,
      variableId: purchase.items[0]?.variableId || '',
      quantity: purchase.items[0]?.quantity || 1,
      unitCost: purchase.items[0]?.unitCost || 0,
      date: new Date(purchase.createdAt).toISOString().slice(0, 10),
    });
  }

  async function handleSubmitPurchaseUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPurchase) return;
    if (!editForm.supplierId || !editForm.variableId || editForm.quantity <= 0 || editForm.unitCost < 0) {
      setMessage('Dados inválidos para editar compra.');
      return;
    }

    const response = await fetch('/api/purchases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingPurchase.id,
        supplierId: editForm.supplierId,
        purchasedAt: editForm.date,
        items: [{ variableId: editForm.variableId, quantity: editForm.quantity, unitCost: editForm.unitCost }],
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

  // ==========================================
  // FILTERED DATA
  // ==========================================

  const filteredPurchases = purchaseOrders.filter((purchase) => {
    const date = new Date(purchase.createdAt);
    if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && date > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  });

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Pedidos de Compra" description="Gerencie solicitações de compra para fornecedores e atualize o estoque crítico." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {message ? <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p> : null}

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
              {/* ── LOW STOCK ALERTS ── */}
              {section.id === 'suppliers' && (
                <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Estoque crítico</h3>
                  <div className="mt-4 space-y-4">
                    {lowStockVariables.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sem itens em estoque crítico no momento.</p>
                    ) : (
                      lowStockVariables.map((item) => (
                        <div key={item.id} className="rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Estoque: {item.stock} {item.unitOfMeasure || 'un'}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Custo adicional: R$ {item.additionalPrice.toFixed(2)} / {item.unitOfMeasure || 'un'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── SUPPLIER FORM ── */}
              {section.id === 'purchase-form' && (
                <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Fornecedores</h3>
                  <form className="mt-4 grid gap-3 rounded-xl p-4" style={{ border: '1px solid var(--border)' }} onSubmit={handleCreateSupplier}>
                    <FormField label="Nome do fornecedor">
                      <Input
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="Nome do fornecedor"
                      />
                    </FormField>
                    <FormField label="Contato">
                      <Input
                        value={supplierContact}
                        onChange={(e) => setSupplierContact(e.target.value)}
                        placeholder="Telefone, email..."
                      />
                    </FormField>
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}
                      type="submit"
                    >
                      Adicionar fornecedor
                    </button>
                  </form>
                  <div className="mt-4 space-y-4">
                    {suppliers.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum fornecedor cadastrado ainda.</p>
                    ) : (
                      suppliers.map((supplier) => (
                        <div key={supplier.id} className="rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{supplier.name}</p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Contato: {supplier.contact || 'Não informado'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── PURCHASE FORM ── */}
              {section.id === 'purchase-history' && (
                <section className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Registrar compra</h3>
                  <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreatePurchase}>
                    <FormField label="Fornecedor">
                      <Select
                        value={form.supplierId}
                        onChange={(e) => updateForm({ supplierId: e.target.value })}
                      >
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Item do estoque">
                      <Select
                        value={form.variableId}
                        onChange={(e) => updateForm({ variableId: e.target.value })}
                      >
                        {variables.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.unitOfMeasure || 'un'})
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Quantidade comprada">
                      <Input
                        type="number"
                        min={1}
                        value={form.quantity}
                        onChange={(e) => updateForm({ quantity: Number(e.target.value) })}
                      />
                    </FormField>

                    <FormField label="Custo unitário (R$)">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.unitCost}
                        onChange={(e) => updateForm({ unitCost: Number(e.target.value) })}
                      />
                    </FormField>

                    <FormField label="Data da compra">
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(e) => updateForm({ date: e.target.value })}
                      />
                    </FormField>

                    <div className="flex items-end">
                      <button
                        className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                        style={{ background: 'var(--brand)', color: '#fff' }}
                        type="submit"
                      >
                        Registrar compra
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* ── PURCHASE RECORDS ── */}
              {section.id === 'purchase-records' && (
                <section className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <div className="flex flex-wrap items-end gap-3">
                    <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Compras registradas</h3>
                    <FormField label="Data inicial">
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        ariaLabel="Data inicial das compras"
                        title="Data inicial das compras"
                      />
                    </FormField>
                    <FormField label="Data final">
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        ariaLabel="Data final das compras"
                        title="Data final das compras"
                      />
                    </FormField>
                  </div>
                  <div className="mt-4 space-y-3">
                    {filteredPurchases.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma compra no período selecionado.</p>
                    ) : (
                      filteredPurchases.map((purchase) => {
                        const total = purchase.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
                        const itemsLabel = purchase.items
                          .map((item) => `${findVariableName(item.variableId)} ${item.quantity}x`)
                          .join(', ');
                        return (
                          <div key={purchase.id} className="rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{itemsLabel || 'Itens da compra'}</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              Fornecedor: {findSupplierName(purchase.supplierId)}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              Data: {new Date(purchase.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              Total: R$ {total.toFixed(2)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditPurchase(purchase)}
                                className="rounded-lg px-3 py-1 text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeletePurchase(purchase.id)}
                                className="rounded-lg px-3 py-1 text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--danger)', color: '#fff' }}
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

        {/* ── EDIT MODAL ── */}
        {editingPurchase && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
            <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Atualizar compra</h3>
              <form className="mt-4 space-y-4" onSubmit={handleSubmitPurchaseUpdate}>
                <FormField label="Fornecedor">
                  <Select value={editForm.supplierId} onChange={(e) => updateEditForm({ supplierId: e.target.value })}>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Item comprado">
                  <Select value={editForm.variableId} onChange={(e) => updateEditForm({ variableId: e.target.value })}>
                    {variables.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.unitOfMeasure || 'un'})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Quantidade">
                  <Input
                    type="number"
                    min={1}
                    value={editForm.quantity}
                    onChange={(e) => updateEditForm({ quantity: Number(e.target.value) })}
                  />
                </FormField>

                <FormField label="Custo unitário (R$)">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.unitCost}
                    onChange={(e) => updateEditForm({ unitCost: Number(e.target.value) })}
                  />
                </FormField>

                <FormField label="Data da compra">
                  <Input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => updateEditForm({ date: e.target.value })}
                  />
                </FormField>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPurchase(null)}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}

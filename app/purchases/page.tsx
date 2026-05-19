'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader, Select, Checkbox, FormField, Input } from '../components/ui';
import { ValidatedInput } from '../components/validated-field';
import { SkeletonProductList, SkeletonOrderList, SkeletonForm } from '../components/skeleton';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { apiFetch } from '../lib/apiFetch';
import { toast } from '../components/ui/Toast';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import type { UnitOfMeasure, Supplier, PurchaseItem, PurchaseOrder, PurchaseCartItem, VariableOption, GroupOption, ProductOption } from '../../types';

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const supplierSchema = z.object({
  name: z.string().min(1, 'Informe o nome do fornecedor').min(2, 'Mínimo de 2 caracteres'),
  contact: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

// ==========================================
// UNIT LABELS
// ==========================================

const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  'un': 'unidade',
  'cm²': 'cm²',
  'm²': 'm²',
  'kg': 'kg',
  'g': 'g',
  'l': 'litro',
  'ml': 'ml',
  'm': 'metro',
  'cm': 'cm',
};

function unitLabel(unit: UnitOfMeasure): string {
  return UNIT_LABELS[unit] || unit;
}

function unitPriceLabel(unit: UnitOfMeasure): string {
  return `Preço por ${unitLabel(unit)}`;
}

// ==========================================
// PAGE COMPONENT
// ==========================================

export default function PurchasesPage() {
  // ── Data lists ──
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [lowStockVariables, setLowStockVariables] = useState<VariableOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // ── Supplier editing ──
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editSupplierContact, setEditSupplierContact] = useState('');

  // ── Supplier form (Zod + React Hook Form) ──
  const {
    register: registerSupplier,
    handleSubmit: handleSupplierSubmit,
    formState: { errors: supplierErrors },
    reset: resetSupplier,
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    mode: 'onBlur',
  });

  // ── Cascading selection ──
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedVariableId, setSelectedVariableId] = useState('');
  const [cartQuantity, setCartQuantity] = useState(1);
  const [cartUnitCost, setCartUnitCost] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState('');

  // ── Cart ──
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);

  // ── Edit mode ──
  const [editingPurchase, setEditingPurchase] = useState<PurchaseOrder | null>(null);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editItems, setEditItems] = useState<PurchaseItem[]>([]);
  const [editDate, setEditDate] = useState('');

  // ── Filters ──
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ── Feedback ──
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

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
  // DERIVED DATA
  // ==========================================

  /** Groups for the selected product */
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  );

  const availableGroups = useMemo(
    () => selectedProduct?.groups || [],
    [selectedProduct],
  );

  /** Variables for the selected group */
  const selectedGroup = useMemo(
    () => availableGroups.find((g) => g.id === selectedGroupId),
    [availableGroups, selectedGroupId],
  );

  const availableVariables = useMemo(
    () => selectedGroup?.variables || [],
    [selectedGroup],
  );

  /** Currently selected variable */
  const selectedVariable = useMemo(
    () => availableVariables.find((v) => v.id === selectedVariableId),
    [availableVariables, selectedVariableId],
  );

  /** All variables flat (for lookup) */
  const allVariables = useMemo(
    () => products.flatMap((p) => p.groups.flatMap((g) => g.variables)),
    [products],
  );

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

  function findVariableInfo(id: string): { name: string; unit: UnitOfMeasure; productName: string; groupName: string } | null {
    for (const product of products) {
      for (const group of product.groups) {
        const variable = group.variables.find((v) => v.id === id);
        if (variable) {
          return {
            name: variable.name,
            unit: variable.unitOfMeasure || 'un',
            productName: product.name,
            groupName: group.name,
          };
        }
      }
    }
    return null;
  }

  // ==========================================
  // DATA LOADING
  // ==========================================

  async function loadDashboard() {
    const response = await apiFetch('/api/v1/purchases', {
      cache: 'no-store',
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.message || 'Falha ao carregar dados de compras.');
      return;
    }
    setSuppliers(data.suppliers || []);
    setLowStockVariables(data.lowStockVariables || []);
    setPurchaseOrders(data.purchaseOrders || []);

    // Build product tree with groups and variables
    const rawProducts = data.products || [];
    const rawGroups = data.groups || [];
    const rawVariables = data.variables || [];

    const productTree: ProductOption[] = rawProducts.map((product: { id: string; name: string; basePrice: number }) => ({
      ...product,
      groups: rawGroups
        .filter((g: { productId: string }) => g.productId === product.id)
        .map((group: { id: string; name: string; productId: string }) => ({
          ...group,
          variables: rawVariables.filter((v: { groupId: string }) => v.groupId === group.id),
        })),
    }));
    setProducts(productTree);

    // Auto-select first supplier
    if (data.suppliers?.length && !selectedSupplierId) {
      setSelectedSupplierId(data.suppliers[0].id);
    }
  }

  useEffect(() => {
    setLoading(true);
    void loadDashboard().finally(() => setLoading(false));
  }, []);

  // Reset cascading selections when parent changes
  useEffect(() => {
    setSelectedGroupId('');
    setSelectedVariableId('');
  }, [selectedProductId]);

  useEffect(() => {
    setSelectedVariableId('');
  }, [selectedGroupId]);

  // ==========================================
  // SUPPLIER ACTIONS
  // ==========================================

  async function handleCreateSupplier(data: SupplierFormData) {
    const response = await apiFetch('/api/v1/suppliers', { method: 'POST', body: JSON.stringify(data),
     });
    const result = await safeJson(response);
    if (!response.ok) {
      setMessage(result.message || 'Falha ao criar fornecedor.');
      return;
    }
    setMessage(result.message || 'Fornecedor criado com sucesso.');
    resetSupplier();
    setSuppliers((prev) => [result.supplier, ...prev]);
  }

  function handleStartEditSupplier(supplier: Supplier) {
    setEditingSupplier(supplier);
    setEditSupplierName(supplier.name);
    setEditSupplierContact(supplier.contact || '');
  }

  async function handleUpdateSupplier() {
    if (!editingSupplier) return;
    if (!editSupplierName.trim()) {
      setMessage('Nome do fornecedor é obrigatório.');
      return;
    }
    const response = await apiFetch('/api/v1/suppliers', {
      method: 'PATCH',
      body: JSON.stringify({ id: editingSupplier.id, name: editSupplierName, contact: editSupplierContact }),
    });
    const result = await safeJson(response);
    if (!response.ok) {
      setMessage(result.message || 'Falha ao editar fornecedor.');
      return;
    }
    toast('Fornecedor atualizado com sucesso!', 'success');
    setEditingSupplier(null);
    setSuppliers((prev) => prev.map(s => s.id === editingSupplier.id ? { ...s, ...result.supplier } : s));
  }

  async function handleDeleteSupplier(supplierId: string) {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    const response = await apiFetch(`/api/v1/suppliers?id=${encodeURIComponent(supplierId)}`, { method: 'DELETE' });
    const result = await safeJson(response);
    if (!response.ok) {
      setMessage(result.message || 'Falha ao excluir fornecedor.');
      return;
    }
    toast('Fornecedor excluído com sucesso!', 'success');
    setSuppliers((prev) => prev.filter(s => s.id !== supplierId));
  }

  // ==========================================
  // CART ACTIONS
  // ==========================================

  function handleAddToCart() {
    if (!selectedVariable || !selectedProduct || !selectedGroup) return;
    if (cartQuantity <= 0 || cartUnitCost < 0) {
      setMessage('Preencha quantidade e preço corretamente.');
      return;
    }

    const newItem: PurchaseCartItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      variableId: selectedVariable.id,
      variableName: selectedVariable.name,
      unitOfMeasure: selectedVariable.unitOfMeasure || 'un',
      quantity: cartQuantity,
      unitCost: cartUnitCost,
    };

    setCart((prev) => [...prev, newItem]);
    setMessage(`${selectedVariable.name} adicionado ao carrinho.`);

    // Reset selection to variable level (keep supplier, product, group)
    setSelectedVariableId('');
    setCartQuantity(1);
    setCartUnitCost(0);
  }

  function handleRemoveFromCart(itemId: string) {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  }

  function handleClearCart() {
    setCart([]);
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  // ==========================================
  // PURCHASE ACTIONS
  // ==========================================

  async function handleSubmitCart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0) {
      setMessage('Adicione itens ao carrinho antes de registrar.');
      return;
    }
    if (!selectedSupplierId) {
      setMessage('Selecione um fornecedor.');
      return;
    }

    const items = cart.map((item) => ({
      variableId: item.variableId,
      quantity: item.quantity,
      unitCost: item.unitCost,
    }));

    const response = await apiFetch('/api/v1/purchases', { method: 'POST', body: JSON.stringify({
        supplierId: selectedSupplierId,
        purchasedAt: purchaseDate || undefined,
        items,
       }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.message || 'Falha ao registrar compra.');
      return;
    }
    toast('Compra registrada com sucesso!', 'success');
    setCart([]);
    setPurchaseDate('');
    await loadDashboard();
  }

  function handleEditPurchase(purchase: PurchaseOrder) {
    setEditingPurchase(purchase);
    setEditSupplierId(purchase.supplierId);
    setEditItems([...purchase.items]);
    setEditDate(new Date(purchase.createdAt).toISOString().slice(0, 10));
  }

  function handleEditItemChange(index: number, field: keyof PurchaseItem, value: string | number) {
    setEditItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleEditRemoveItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmitPurchaseUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPurchase) return;
    if (!editSupplierId || editItems.length === 0) {
      setMessage('Dados inválidos para editar compra.');
      return;
    }

    const response = await apiFetch('/api/v1/purchases', { method: 'PATCH', body: JSON.stringify({
        id: editingPurchase.id,
        supplierId: editSupplierId,
        purchasedAt: editDate,
        items: editItems,
       }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.message || 'Falha ao editar compra.');
      return;
    }
    toast('Compra atualizada com sucesso!', 'success');
    setEditingPurchase(null);
    await loadDashboard();
  }

  async function handleDeletePurchase(purchaseId: string) {
    if (!confirm(`Excluir a compra ${purchaseId}?`)) return;
    const response = await apiFetch(`/api/purchases?id=${encodeURIComponent(purchaseId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.message || 'Falha ao excluir compra.');
      return;
    }
    toast('Compra excluída com sucesso!', 'success');
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

        {message ? (
          <p className="mb-4 rounded-xl px-4 py-2 text-sm" style={{ background: 'var(--brand-muted)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}>
            {message}
          </p>
        ) : null}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <SkeletonForm fields={3} />
              </div>
              <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <SkeletonForm fields={5} />
              </div>
            </div>
            <SkeletonOrderList count={3} />
          </div>
        )}

        {!loading && (
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
                  <div className="mt-4 space-y-3">
                    {lowStockVariables.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sem itens em estoque crítico no momento.</p>
                    ) : (
                      lowStockVariables.map((item) => {
                        const info = findVariableInfo(item.id);
                        return (
                          <div key={item.id} className="flex items-center justify-between rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--surface-soft)' }}>
                            <div>
                              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                              {info && (
                                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                                  {info.productName} › {info.groupName}
                                </p>
                              )}
                            </div>
                            <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                              {item.stock} {item.unitOfMeasure || 'un'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ── SUPPLIER FORM ── */}
              {section.id === 'purchase-form' && (
                <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Fornecedores</h3>
                  <form className="mt-4 grid gap-3 rounded-xl p-4" style={{ border: '1px solid var(--border)' }} onSubmit={handleSupplierSubmit(handleCreateSupplier)} noValidate>
                    <ValidatedInput
                      label="Nome do fornecedor"
                      {...registerSupplier('name')}
                      error={supplierErrors.name}
                      placeholder="Nome do fornecedor"
                    />
                    <ValidatedInput
                      label="Contato"
                      {...registerSupplier('contact')}
                      error={supplierErrors.contact}
                      placeholder="Telefone, email..."
                    />
                    <button
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}
                      type="submit"
                    >
                      Adicionar fornecedor
                    </button>
                  </form>
                  <div className="mt-4 space-y-3">
                    {suppliers.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum fornecedor cadastrado ainda.</p>
                    ) : (
                      suppliers.map((supplier) => (
                        editingSupplier?.id === supplier.id ? (
                          <div key={supplier.id} className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--brand)', background: 'var(--surface-soft)' }}>
                            <input
                              className="w-full rounded-lg px-3 py-2 text-sm"
                              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                              value={editSupplierName}
                              onChange={e => setEditSupplierName(e.target.value)}
                              placeholder="Nome do fornecedor"
                            />
                            <input
                              className="w-full rounded-lg px-3 py-2 text-sm"
                              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                              value={editSupplierContact}
                              onChange={e => setEditSupplierContact(e.target.value)}
                              placeholder="Contato"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleUpdateSupplier}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                                style={{ background: 'var(--brand)' }}
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingSupplier(null)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div key={supplier.id} className="group flex items-center justify-between rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
                            <div>
                              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{supplier.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Contato: {supplier.contact || 'Não informado'}
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => handleStartEditSupplier(supplier)}
                                className="rounded-lg p-1.5 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-muted)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                title="Editar"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteSupplier(supplier.id)}
                                className="rounded-lg p-1.5 transition-colors"
                                style={{ color: 'var(--danger)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                title="Excluir"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── PURCHASE FORM WITH CART ── */}
              {section.id === 'purchase-history' && (
                <section className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Registrar compra</h3>

                  {/* Cascading selection */}
                  <div className="mt-4 space-y-4">
                    {/* Row 1: Supplier + Date */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField label="Fornecedor">
                        <Select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Data da compra">
                        <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                      </FormField>
                    </div>

                    {/* Row 2: Product → Group → Variable (cascading) */}
                    <div className="rounded-xl p-4" style={{ border: '1px solid var(--border)', background: 'var(--surface-soft)' }}>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                        Selecionar item
                      </p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <FormField label="Produto">
                          <Select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </Select>
                        </FormField>

                        <FormField label="Grupo">
                          <Select
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            disabled={!selectedProductId}
                          >
                            <option value="">Selecione...</option>
                            {availableGroups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </Select>
                        </FormField>

                        <FormField label="Variável">
                          <Select
                            value={selectedVariableId}
                            onChange={(e) => setSelectedVariableId(e.target.value)}
                            disabled={!selectedGroupId}
                          >
                            <option value="">Selecione...</option>
                            {availableVariables.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} — estoque: {v.stock} {v.unitOfMeasure || 'un'}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      </div>
                    </div>

                    {/* Row 3: Quantity + Unit Price (with unit label) */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField label="Quantidade comprada">
                        <Input
                          type="number"
                          min={1}
                          value={cartQuantity}
                          onChange={(e) => setCartQuantity(Number(e.target.value))}
                          placeholder={selectedVariable ? `Em ${unitLabel(selectedVariable.unitOfMeasure || 'un')}` : ''}
                        />
                      </FormField>

                      <FormField label={selectedVariable ? unitPriceLabel(selectedVariable.unitOfMeasure || 'un') : 'Preço unitário (R$)'}>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={cartUnitCost}
                          onChange={(e) => setCartUnitCost(Number(e.target.value))}
                        />
                      </FormField>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          disabled={!selectedVariableId}
                          className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ background: 'var(--brand)', color: '#fff' }}
                        >
                          + Adicionar ao carrinho
                        </button>
                      </div>
                    </div>

                    {/* Unit info badge */}
                    {selectedVariable && (
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}>
                        <span className="font-medium">{selectedVariable.name}</span>
                        <span style={{ color: 'var(--text-faint)' }}>•</span>
                        <span>Unidade: {unitLabel(selectedVariable.unitOfMeasure || 'un')}</span>
                        <span style={{ color: 'var(--text-faint)' }}>•</span>
                        <span>Estoque atual: {selectedVariable.stock} {selectedVariable.unitOfMeasure || 'un'}</span>
                      </div>
                    )}
                  </div>

                  {/* ── CART ── */}
                  {cart.length > 0 && (
                    <div className="mt-6 rounded-xl p-4" style={{ border: '1px solid var(--brand-border)', background: 'var(--surface-soft)' }}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Carrinho ({cart.length} {cart.length === 1 ? 'item' : 'itens'})
                        </h4>
                        <button
                          type="button"
                          onClick={handleClearCart}
                          className="text-xs font-medium transition-colors hover:opacity-80"
                          style={{ color: 'var(--danger)' }}
                        >
                          Limpar tudo
                        </button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {item.productName} › {item.groupName} › {item.variableName}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {item.quantity} {unitLabel(item.unitOfMeasure)} × R$ {item.unitCost.toFixed(2)} = R$ {(item.quantity * item.unitCost).toFixed(2)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.id)}
                              className="ml-2 flex-shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--danger-bg)]"
                              style={{ color: 'var(--danger)' }}
                              title="Remover item"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Total: R$ {cartTotal.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleSubmitCart({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>)}
                          className="rounded-xl px-5 py-2 text-sm font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--brand)', color: '#fff' }}
                        >
                          Registrar compra
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ── PURCHASE RECORDS ── */}
              {section.id === 'purchase-records' && (
                <section className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <div className="flex flex-wrap items-end gap-3">
                    <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Compras registradas</h3>
                    <FormField label="Data inicial">
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} ariaLabel="Data inicial das compras" title="Data inicial das compras" />
                    </FormField>
                    <FormField label="Data final">
                      <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} ariaLabel="Data final das compras" title="Data final das compras" />
                    </FormField>
                  </div>
                  <div className="mt-4 space-y-3">
                    {filteredPurchases.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma compra no período selecionado.</p>
                    ) : (
                      filteredPurchases.map((purchase) => {
                        const total = purchase.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
                        const itemsLabel = purchase.items
                          .map((item) => {
                            const info = findVariableInfo(item.variableId);
                            const name = info ? `${info.productName} › ${info.groupName} › ${info.name}` : item.variableId;
                            return `${name} ${item.quantity}x`;
                          })
                          .join(', ');
                        return (
                          <div key={purchase.id} className="rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{itemsLabel || 'Itens da compra'}</p>
                            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                              Fornecedor: {findSupplierName(purchase.supplierId)} • {new Date(purchase.createdAt).toLocaleDateString()} • Total: R$ {total.toFixed(2)}
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
        )}

        {/* ── EDIT MODAL ── */}
        {editingPurchase && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
            <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Atualizar compra</h3>
              <form className="mt-4 space-y-4" onSubmit={handleSubmitPurchaseUpdate}>
                <FormField label="Fornecedor">
                  <Select value={editSupplierId} onChange={(e) => setEditSupplierId(e.target.value)}>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Data da compra">
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </FormField>

                <div className="space-y-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Itens</p>
                  {editItems.map((item, index) => {
                    const info = findVariableInfo(item.variableId);
                    return (
                      <div key={index} className="flex items-center gap-2 rounded-lg p-2" style={{ border: '1px solid var(--border)', background: 'var(--surface-soft)' }}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                            {info ? `${info.productName} › ${info.groupName} › ${info.name}` : item.variableId}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleEditItemChange(index, 'quantity', Number(e.target.value))}
                          className="w-20"
                        />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitCost}
                          onChange={(e) => handleEditItemChange(index, 'unitCost', Number(e.target.value))}
                          className="w-28"
                        />
                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEditRemoveItem(index)}
                            className="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--danger-bg)]"
                            style={{ color: 'var(--danger)' }}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPurchase(null)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80"
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

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
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import type { UnitOfMeasure } from '../../types';

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const supplierSchema = z.object({
  name: z.string().min(1, 'Informe o nome do fornecedor').min(2, 'Mínimo de 2 caracteres'),
  contact: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

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
  unitOfMeasure?: UnitOfMeasure;
  groupId: string;
}

interface Group {
  id: string;
  name: string;
  productId: string;
  variables: Variable[];
}

interface Product {
  id: string;
  name: string;
  basePrice: number;
  groups: Group[];
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

/** Item no carrinho antes de enviar */
interface CartItem {
  id: string; // local id for removal
  productId: string;
  productName: string;
  groupId: string;
  groupName: string;
  variableId: string;
  variableName: string;
  unitOfMeasure: UnitOfMeasure;
  quantity: number;
  unitCost: number;
}

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
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockVariables, setLowStockVariables] = useState<Variable[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

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
  const [cart, setCart] = useState<CartItem[]>([]);

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
    setPurchaseOrders(data.purchaseOrders || []);

    // Build product tree with groups and variables
    const rawProducts = data.products || [];
    const rawGroups = data.groups || [];
    const rawVariables = data.variables || [];

    const productTree: Product[] = rawProducts.map((product: { id: string; name: string; basePrice: number }) => ({
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
    const response = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    const result = await safeJson(response);
    if (!response.ok) {
      setMessage(result.error || 'Falha ao criar fornecedor.');
      return;
    }
    setMessage(result.message || 'Fornecedor criado com sucesso.');
    resetSupplier();
    setSuppliers((prev) => [result.supplier, ...prev]);
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

    const newItem: CartItem = {
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

    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        supplierId: selectedSupplierId,
        purchasedAt: purchaseDate || undefined,
        items,
      }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      setMessage(data.error || 'Falha ao registrar compra.');
      return;
    }
    setMessage(data.message || 'Compra registrada com sucesso.');
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

    const response = await fetch('/api/purchases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingPurchase.id,
        supplierId: editSupplierId,
        purchasedAt: editDate,
        items: editItems,
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
                        <div key={supplier.id} className="rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{supplier.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Contato: {supplier.contact || 'Não informado'}
                          </p>
                        </div>
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

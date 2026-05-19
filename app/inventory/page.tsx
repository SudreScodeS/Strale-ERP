'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader, Select } from '../components/ui';
import { ValidatedInput, ValidatedTextarea, ValidatedSelect } from '../components/validated-field';
import { SkeletonProductList, SkeletonMetrics } from '../components/skeleton';
import { ProtectedPage } from '../components/protected';
import { PageTitle } from '../components/PageTitle';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import type { UnitOfMeasure, VariableOption, GroupOption, ProductOption } from '../../types';

const DEFAULT_WATCH_STOCK_ALERT = 30;
const DEFAULT_CRITICAL_STOCK_ALERT = 10;

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const productSchema = z.object({
  name: z.string().min(1, 'Informe o nome do produto').min(2, 'Mínimo de 2 caracteres'),
  basePrice: z.coerce.number().min(0.01, 'O preço deve ser maior que zero'),
  profitMargin: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
  description: z.string().optional(),
});

const groupSchema = z.object({
  name: z.string().min(1, 'Informe o nome do grupo').min(2, 'Mínimo de 2 caracteres'),
  productId: z.string().min(1, 'Selecione um produto'),
});

const variableSchema = z.object({
  name: z.string().min(1, 'Informe o nome da variável').min(2, 'Mínimo de 2 caracteres'),
  groupId: z.string().min(1, 'Selecione um grupo'),
  additionalPrice: z.coerce.number().min(0, 'O preço não pode ser negativo'),
  stock: z.coerce.number().min(0, 'O estoque não pode ser negativo'),
});

type ProductFormData = z.infer<typeof productSchema>;
type GroupFormData = z.infer<typeof groupSchema>;
type VariableFormData = z.infer<typeof variableSchema>;

export default function InventoryPage() {
  const [inventory, setInventory] = useState<ProductOption[]>([]);
  const [message, setMessage] = useState('');
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState(0);
  const [productMargin, setProductMargin] = useState(20);
  const [productDescription, setProductDescription] = useState('');
  const [productImage, setProductImage] = useState<string>('');
  const [groupProductId, setGroupProductId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupWatchAlert, setGroupWatchAlert] = useState(DEFAULT_WATCH_STOCK_ALERT);
  const [groupCriticalAlert, setGroupCriticalAlert] = useState(DEFAULT_CRITICAL_STOCK_ALERT);
  const [variableGroupId, setVariableGroupId] = useState('');
  const [variableName, setVariableName] = useState('');
  const [variablePrice, setVariablePrice] = useState(0);
  const [variableStock, setVariableStock] = useState(0);
  const [variableUnit, setVariableUnit] = useState<UnitOfMeasure>('un');
  const [activeForm, setActiveForm] = useState<'product' | 'group' | 'variable'>('product');
  const [editingVariable, setEditingVariable] = useState<VariableOption | null>(null);
  const [editVariableName, setEditVariableName] = useState('');
  const [editVariablePrice, setEditVariablePrice] = useState(0);
  const [editVariableStock, setEditVariableStock] = useState(0);
  const [editVariableUnit, setEditVariableUnit] = useState<UnitOfMeasure>('un');
  const [editingProduct, setEditingProduct] = useState<ProductOption | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editProductPrice, setEditProductPrice] = useState(0);
  const [editProductMargin, setEditProductMargin] = useState(20);
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editProductImage, setEditProductImage] = useState('');
  const [editingGroup, setEditingGroup] = useState<GroupOption | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupWatchAlert, setEditGroupWatchAlert] = useState(DEFAULT_WATCH_STOCK_ALERT);
  const [editGroupCriticalAlert, setEditGroupCriticalAlert] = useState(DEFAULT_CRITICAL_STOCK_ALERT);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageTab, setPageTab] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(true);

  const PAGE_PATH = '/inventory';
  const DEFAULT_SECTIONS: SectionConfig[] = [
    { id: 'inventory-list', visible: true, order: 0, colSpan: 2 },
    { id: 'add-forms', visible: true, order: 1, colSpan: 1 },
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

  async function loadInventory() {
    const response = await fetch('/api/v1/inventory', {
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    const list = data.inventory || [];
    setInventory(list);
    setLoading(false);
    if (list.length > 0) {
      setGroupProductId((prev) => prev || list[0].id);
      const firstGroup = list[0].groups?.[0];
      if (firstGroup) {
        setVariableGroupId((prev) => prev || firstGroup.id);
      }
      if (!expandedProduct && list.length > 0) {
        setExpandedProduct(list[0].id);
      }
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/v1/inventory/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name: productName, basePrice: productPrice, description: productDescription, imageUrl: productImage, profitMargin: productMargin }),
    });
    const result = await safeJson(response);
    if (response.ok) {
      setMessage(result.message);
      setProductName('');
      setProductPrice(0);
      setProductMargin(20);
      setProductDescription('');
      setProductImage('');
      await loadInventory();
    } else {
      setMessage(result.message || 'Erro ao criar produto.');
    }
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (groupCriticalAlert > groupWatchAlert) {
      setMessage('O limite crítico deve ser menor ou igual ao limite de atenção.');
      return;
    }
    const response = await fetch('/api/v1/inventory/group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        productId: groupProductId,
        name: groupName,
        watchStockAlert: groupWatchAlert,
        criticalStockAlert: groupCriticalAlert,
      }),
    });
    const result = await safeJson(response);
    if (response.ok) {
      setMessage(result.message);
      setGroupName('');
      setGroupWatchAlert(DEFAULT_WATCH_STOCK_ALERT);
      setGroupCriticalAlert(DEFAULT_CRITICAL_STOCK_ALERT);
      await loadInventory();
    } else {
      setMessage(result.message || 'Erro ao criar grupo.');
    }
  }

  async function handleCreateVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/v1/inventory/variable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ groupId: variableGroupId, name: variableName, additionalPrice: variablePrice, stock: variableStock, unitOfMeasure: variableUnit }),
    });
    const result = await safeJson(response);
    if (response.ok) {
      setMessage(result.message);
      setVariableName('');
      setVariablePrice(0);
      setVariableStock(0);
      setVariableUnit('un');
      await loadInventory();
    } else {
      setMessage(result.message || 'Erro ao criar variável.');
    }
  }

  function handleUpdateProduct(product: ProductOption) {
    setEditingProduct(product);
    setEditProductName(product.name);
    setEditProductPrice(product.basePrice);
    setEditProductMargin(product?.profitMargin ?? 20);
    setEditProductDescription(product.description || '');
    setEditProductImage(product.imageUrl || '');
  }

  async function handleSubmitProductUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    const response = await fetch('/api/v1/inventory/product', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingProduct.id,
        name: editProductName,
        basePrice: editProductPrice,
        profitMargin: editProductMargin,
        description: editProductDescription,
        imageUrl: editProductImage,
      }),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.message || 'Produto atualizado.');
    if (response.ok) {
      setEditingProduct(null);
      await loadInventory();
    }
  }

  async function handleDeleteProduct(product: ProductOption) {
    if (!confirm(`Excluir produto "${product.name}" com grupos e variáveis?`)) return;
    const response = await fetch(`/api/inventory/product?id=${encodeURIComponent(product.id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.message || 'Operação concluída.');
    if (response.ok) await loadInventory();
  }

  function handleUpdateGroup(group: GroupOption) {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupWatchAlert(group.watchStockAlert ?? DEFAULT_WATCH_STOCK_ALERT);
    setEditGroupCriticalAlert(group.criticalStockAlert ?? DEFAULT_CRITICAL_STOCK_ALERT);
  }

  async function handleSubmitGroupUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingGroup) return;
    if (editGroupCriticalAlert > editGroupWatchAlert) {
      setMessage('O limite crítico deve ser menor ou igual ao limite de atenção.');
      return;
    }
    const response = await fetch('/api/v1/inventory/group', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingGroup.id,
        name: editGroupName,
        watchStockAlert: editGroupWatchAlert,
        criticalStockAlert: editGroupCriticalAlert,
      }),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.message || 'Grupo atualizado.');
    if (response.ok) {
      setEditingGroup(null);
      await loadInventory();
    }
  }

  async function handleDeleteGroup(group: GroupOption) {
    if (!confirm(`Excluir grupo "${group.name}" e todas as variáveis?`)) return;
    const response = await fetch(`/api/inventory/group?id=${encodeURIComponent(group.id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.message || 'Operação concluída.');
    if (response.ok) await loadInventory();
  }

  async function handleUpdateVariable(variable: VariableOption) {
    setEditingVariable(variable);
    setEditVariableName(variable.name);
    setEditVariablePrice(variable.additionalPrice);
    setEditVariableStock(variable.stock);
    setEditVariableUnit(variable.unitOfMeasure || 'un');
  }

  async function handleSubmitVariableUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVariable) return;
    const response = await fetch('/api/v1/inventory/variable', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingVariable.id,
        name: editVariableName,
        additionalPrice: editVariablePrice,
        stock: editVariableStock,
        unitOfMeasure: editVariableUnit,
      }),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.message || 'Variável atualizada.');
    if (response.ok) {
      setEditingVariable(null);
      await loadInventory();
    }
  }

  async function handleDeleteVariable(variable: VariableOption) {
    if (!confirm(`Excluir variável "${variable.name}"?`)) return;
    const response = await fetch(`/api/inventory/variable?id=${encodeURIComponent(variable.id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.message || 'Operação concluída.');
    if (response.ok) await loadInventory();
  }

  const allGroups = inventory.flatMap((product) =>
    product.groups.map((group) => ({
      ...group,
      productName: product.name,
    })),
  );

  function getGroupStockStatus(group: GroupOption, stock: number): 'critical' | 'watch' | 'ok' {
    const criticalLimit = group.criticalStockAlert ?? DEFAULT_CRITICAL_STOCK_ALERT;
    const watchLimit = group.watchStockAlert ?? DEFAULT_WATCH_STOCK_ALERT;
    if (stock <= criticalLimit) return 'critical';
    if (stock <= watchLimit) return 'watch';
    return 'ok';
  }

  // Summary stats
  const stats = useMemo(() => {
    const totalProducts = inventory.length;
    const totalGroups = inventory.reduce((sum, p) => sum + p.groups.length, 0);
    const totalVariables = inventory.reduce((sum, p) => sum + p.groups.reduce((s, g) => s + g.variables.length, 0), 0);
    const totalStock = inventory.reduce((sum, p) => sum + p.groups.reduce((s, g) => s + g.variables.reduce((vs, v) => vs + v.stock, 0), 0), 0);
    const criticalCount = inventory.reduce((sum, p) => sum + p.groups.reduce((s, g) => s + g.variables.filter(v => getGroupStockStatus(g, v.stock) === 'critical').length, 0), 0);
    const watchCount = inventory.reduce((sum, p) => sum + p.groups.reduce((s, g) => s + g.variables.filter(v => getGroupStockStatus(g, v.stock) === 'watch').length, 0), 0);
    return { totalProducts, totalGroups, totalVariables, totalStock, criticalCount, watchCount };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (!searchTerm.trim()) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term) ||
      p.groups.some(g =>
        g.name.toLowerCase().includes(term) ||
        g.variables.some(v => v.name.toLowerCase().includes(term))
      )
    );
  }, [inventory, searchTerm]);

  // Lock body scroll when edit modal is open
  useEffect(() => {
    if (editingVariable || editingProduct || editingGroup) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [editingVariable, editingProduct, editingGroup]);

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageTitle title="Estoque" />
        <PageHeader title="Estoque" description="Gestão de estoque com grupos e variáveis configuráveis dinamicamente." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {/* Toast de mensagem */}
        {message ? (
          <div className="mb-6 flex items-center justify-between rounded-xl px-5 py-3 text-sm" style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)' }}>
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')} className="ml-3 hover:opacity-70" style={{ color: 'var(--success)' }}>✕</button>
          </div>
        ) : null}

        {/* Cards de resumo */}
        {loading ? (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-20 rounded" style={{ background: 'var(--surface-muted)' }} />
                  <div className="h-8 w-16 rounded" style={{ background: 'var(--surface-muted)' }} />
                  <div className="h-3 w-32 rounded" style={{ background: 'var(--surface-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Produtos</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.totalProducts}</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{stats.totalGroups} grupos · {stats.totalVariables} variáveis</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Estoque crítico</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--danger)' }}>{stats.criticalCount}</p>
            <p className="text-xs" style={{ color: 'var(--danger)', opacity: 0.7 }}>variáveis abaixo do limite</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Em atenção</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--warning)' }}>{stats.watchCount}</p>
            <p className="text-xs" style={{ color: 'var(--warning)', opacity: 0.7 }}>variáveis próximas do limite</p>
          </div>
        </div>
        )}

        {/* Tabs de navegação */}
        <div className="mb-6 flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-muted)', width: 'fit-content' }}>
          <button
            type="button"
            onClick={() => setPageTab('list')}
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
            style={{
              background: pageTab === 'list' ? 'var(--card-bg)' : 'transparent',
              color: pageTab === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: pageTab === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Produtos
          </button>
          <button
            type="button"
            onClick={() => setPageTab('create')}
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
            style={{
              background: pageTab === 'create' ? 'var(--card-bg)' : 'transparent',
              color: pageTab === 'create' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: pageTab === 'create' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Adicionar novo
          </button>
        </div>

        {/* ============================================ */}
        {/* ABA: LISTA DE PRODUTOS */}
        {/* ============================================ */}
        {pageTab === 'list' && (
          <DraggableSection pagePath={PAGE_PATH} section={sections[0]} index={0} totalSections={sections.length}>
            <div className="space-y-4">
              {/* Busca */}
              <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar produto, grupo ou variável..."
                  aria-label="Buscar produto, grupo ou variável"
                  className="w-full rounded-lg px-4 py-2.5 text-sm"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              {loading ? (
                <SkeletonProductList count={4} />
              ) : filteredInventory.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <p style={{ color: 'var(--text-muted)' }}>{searchTerm ? 'Nenhum resultado encontrado.' : 'Nenhum produto cadastrado.'}</p>
                </div>
              ) : (
                filteredInventory.map((product) => {
                  const isExpanded = expandedProduct === product.id;
                  const productTotalStock = product.groups.reduce((s, g) => s + g.variables.reduce((vs, v) => vs + v.stock, 0), 0);
                  const productStockLabel = productTotalStock > 0 ? `${productTotalStock.toLocaleString('pt-BR')} un.` : '0 un.';
                  const productCritical = product.groups.reduce((s, g) => s + g.variables.filter(v => getGroupStockStatus(g, v.stock) === 'critical').length, 0);

                  return (
                    <div key={product.id} className="overflow-hidden rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                      {/* Header do produto - clicável para expandir */}
                      <div
                        className="flex cursor-pointer items-center gap-4 p-5 transition-colors"
                        style={{ background: 'var(--card-bg)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-soft)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-bg)'; }}
                        onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedProduct(isExpanded ? null : product.id); }}
                      >
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-14 w-14 rounded-xl object-cover flex-shrink-0" style={{ border: '1px solid var(--border)' }} />
                        ) : (
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: 'var(--surface-muted)', color: 'var(--text-faint)' }}>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{product.name}</h3>
                            {productCritical > 0 && (
                              <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
                                {productCritical} crítico{productCritical > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{product.description || 'Sem descrição'}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                            <span>R$ {product.basePrice.toFixed(2)} base</span>
                            <span>·</span>
                            <span>{product?.profitMargin ?? 20}% margem</span>
                            <span>·</span>
                            <span>{product.groups.length} grupo{product.groups.length !== 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span>{productStockLabel}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleUpdateProduct(product); }}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product); }}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                            style={{ background: 'var(--danger)', color: '#fff' }}
                          >
                            Excluir
                          </button>
                          <svg
                            className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--text-faint)' }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Grupos e variáveis - expansível */}
                      {isExpanded && (
                        <div className="border-t px-5 pb-5" style={{ borderColor: 'var(--border)' }}>
                          {product.groups.length === 0 ? (
                            <p className="py-4 text-sm" style={{ color: 'var(--text-faint)' }}>Nenhum grupo cadastrado.</p>
                          ) : (
                            <div className="mt-4 space-y-3">
                              {product.groups.map((group) => (
                                <div key={group.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                                  {/* Header do grupo */}
                                  <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: 'var(--surface-soft)' }}>
                                    <div className="flex items-center gap-3">
                                      <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{group.name}</h4>
                                      <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                                        {group.variables.length} variáve{group.variables.length !== 1 ? 'is' : 'l'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                                        Alerta: {group.watchStockAlert ?? DEFAULT_WATCH_STOCK_ALERT} · Crítico: {group.criticalStockAlert ?? DEFAULT_CRITICAL_STOCK_ALERT}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateGroup(group)}
                                        className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-80"
                                        style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteGroup(group)}
                                        className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-80"
                                        style={{ background: 'var(--danger)', color: '#fff' }}
                                      >
                                        Excluir
                                      </button>
                                    </div>
                                  </div>

                                  {/* Variáveis */}
                                  <div className="p-4">
                                    {group.variables.length === 0 ? (
                                      <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Nenhuma variável cadastrada.</p>
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {group.variables.map((variable) => {
                                          const status = getGroupStockStatus(group, variable.stock);
                                          const statusStyles = {
                                            critical: { bg: 'var(--danger-bg)', border: 'var(--danger-border)', text: 'var(--danger)' },
                                            watch: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning)' },
                                            ok: { bg: 'var(--card-bg)', border: 'var(--border)', text: 'var(--text-primary)' },
                                          };
                                          const s = statusStyles[status];
                                          return (
                                            <div
                                              key={variable.id}
                                              className="flex items-center justify-between rounded-lg p-3 transition-all"
                                              style={{ background: s.bg, border: `1px solid ${s.border}` }}
                                            >
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{variable.name}</p>
                                                  {status === 'critical' && (
                                                    <span className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>!</span>
                                                  )}
                                                  {status === 'watch' && (
                                                    <span className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' }}>!</span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                  <span className="font-semibold" style={{ color: s.text }}>
                                                    {variable.stock} {variable.unitOfMeasure || 'un'}
                                                  </span>
                                                  {variable.additionalPrice > 0 && (
                                                    <span>+R$ {variable.additionalPrice.toFixed(2)}/{variable.unitOfMeasure || 'un'}</span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex gap-1 ml-2">
                                                <button
                                                  type="button"
                                                  onClick={() => handleUpdateVariable(variable)}
                                                  className="rounded-md px-2 py-1 text-[11px] font-semibold transition-all hover:opacity-80"
                                                  style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                                                >
                                                  Editar
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteVariable(variable)}
                                                  className="rounded-md px-2 py-1 text-[11px] font-semibold transition-all hover:opacity-80"
                                                  style={{ background: 'var(--danger)', color: '#fff' }}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </DraggableSection>
        )}

        {/* ============================================ */}
        {/* ABA: ADICIONAR NOVO */}
        {/* ============================================ */}
        {pageTab === 'create' && (
          <DraggableSection pagePath={PAGE_PATH} section={sections[1]} index={1} totalSections={sections.length}>
            <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              {/* Tabs */}
              <div
                className="mb-6 inline-flex gap-1 rounded-xl p-1"
                style={{ background: 'var(--surface-muted)' }}
              >
                {[
                  { key: 'product' as const, label: 'Produto', desc: 'Base' },
                  { key: 'group' as const, label: 'Grupo', desc: 'Categoria' },
                  { key: 'variable' as const, label: 'Variável', desc: 'Item' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveForm(tab.key)}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
                    style={{
                      background: activeForm === tab.key ? 'var(--card-bg)' : 'transparent',
                      color: activeForm === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: activeForm === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Hierarquia visual */}
              <div className="mb-5 flex items-center gap-2 text-xs text-slate-400">
                <span className={`rounded-full px-2 py-0.5 ${activeForm === 'product' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-slate-100'}`}>Produto</span>
                <span>→</span>
                <span className={`rounded-full px-2 py-0.5 ${activeForm === 'group' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-slate-100'}`}>Grupo</span>
                <span>→</span>
                <span className={`rounded-full px-2 py-0.5 ${activeForm === 'variable' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-slate-100'}`}>Variável</span>
              </div>

              {/* FORM: Produto */}
              {activeForm === 'product' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Novo produto base</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Crie um produto que servirá como base para grupos e variáveis.</p>
                  </div>
                  {/* Explicação com exemplo */}
                  <div className="mb-5 rounded-xl p-4" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>💡 Como funciona</p>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      O <strong>Produto</strong> é o item base do seu estoque. Depois de criado, você pode adicionar <strong>Grupos</strong> (como Cor ou Tamanho) e dentro deles <strong>Variáveis</strong> (como Azul ou Grande).
                    </p>
                    <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                      <p style={{ color: 'var(--text-muted)' }}><strong>Exemplo:</strong></p>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <strong>Produto:</strong> "Camiseta Básica" — Preço base: R$ 25,00
                      </p>
                      <p style={{ color: 'var(--text-faint)' }}>
                        Depois você cria o grupo "Cor" com variáveis como "Branca", "Preta", "Azul"...
                      </p>
                    </div>
                  </div>
                  <form className="space-y-4" onSubmit={handleCreateProduct}>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Nome do produto *</span>
                      <input
                        value={productName}
                        onChange={(event) => setProductName(event.target.value)}
                        placeholder="Ex: Sacola TNT"
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: `1px solid ${productName.trim() && productName.trim().length < 2 ? 'var(--danger, #dc2626)' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                        required
                      />
                      {productName.trim() && productName.trim().length < 2 && (
                        <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
                          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          Mínimo de 2 caracteres
                        </p>
                      )}
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Preço base (R$) *</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={productPrice}
                        onChange={(event) => setProductPrice(Number(event.target.value))}
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: `1px solid ${productPrice < 0 ? 'var(--danger, #dc2626)' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                        required
                      />
                      {productPrice < 0 && (
                        <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
                          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          O preço não pode ser negativo
                        </p>
                      )}
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Margem de lucro (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={productMargin}
                        onChange={(event) => setProductMargin(Number(event.target.value))}
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Margem específica para este produto. Padrão: 20%
                      </p>
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Descrição</span>
                      <textarea
                        value={productDescription}
                        onChange={(event) => setProductDescription(event.target.value)}
                        placeholder="Descrição opcional do produto..."
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                        rows={2}
                      />
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Imagem do produto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setProductImage(String(reader.result || ''));
                          reader.readAsDataURL(file);
                        }}
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                      {productImage && <p className="text-xs" style={{ color: 'var(--success)' }}>Imagem carregada</p>}
                    </label>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}
                      type="submit"
                    >
                      Criar produto
                    </button>
                  </form>
                </div>
              )}

              {/* FORM: Grupo */}
              {activeForm === 'group' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Novo grupo</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Grupos organizam variáveis dentro de um produto (ex: Cor, Tamanho).</p>
                  </div>
                  {/* Explicação com exemplo */}
                  <div className="mb-5 rounded-xl p-4" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>💡 Como funciona</p>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      O <strong>Grupo</strong> é uma categoria dentro de um produto. Ele agrupa as variações disponíveis — como cor, tamanho ou material.
                    </p>
                    <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                      <p style={{ color: 'var(--text-muted)' }}><strong>Exemplo:</strong></p>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <strong>Produto:</strong> "Camiseta Básica"
                      </p>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <strong>Grupo:</strong> "Cor" — (dentro dela você cria variáveis como Azul, Branca, Preta...)
                      </p>
                    </div>
                  </div>
                  <form className="space-y-4" onSubmit={handleCreateGroup}>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Produto vinculado *</span>
                      <Select
                        value={groupProductId}
                        onChange={(event) => setGroupProductId(event.target.value)}
                        className="px-4 py-2.5"
                      >
                        {inventory.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </Select>
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Nome do grupo *</span>
                      <input
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value)}
                        placeholder="Ex: Cor, Tamanho, Material"
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                        required
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm font-medium">Limite de atenção</span>
                        <input
                          type="number"
                          min={0}
                          value={groupWatchAlert}
                          onChange={(event) => setGroupWatchAlert(Number(event.target.value))}
                          className="w-full rounded-lg px-4 py-2.5 text-sm"
                          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                        />
                      </label>
                      <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm font-medium">Limite crítico</span>
                        <input
                          type="number"
                          min={0}
                          value={groupCriticalAlert}
                          onChange={(event) => setGroupCriticalAlert(Number(event.target.value))}
                          className="w-full rounded-lg px-4 py-2.5 text-sm"
                          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                        />
                      </label>
                    </div>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}
                      type="submit"
                    >
                      Criar grupo
                    </button>
                  </form>
                </div>
              )}

              {/* FORM: Variável */}
              {activeForm === 'variable' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Nova variável</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Variáveis são as opções dentro de um grupo (ex: Vermelho, Azul).</p>
                  </div>
                  {/* Explicação com exemplo */}
                  <div className="mb-5 rounded-xl p-4" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>💡 Como funciona</p>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      A <strong>Variável</strong> é a opção concreta dentro de um grupo. Cada variável tem seu próprio estoque e pode ter um preço adicional.
                    </p>
                    <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                      <p style={{ color: 'var(--text-muted)' }}><strong>Exemplo:</strong></p>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <strong>Produto:</strong> "Camiseta Básica"
                      </p>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <strong>Grupo:</strong> "Cor"
                      </p>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        <strong>Variável:</strong> "Azul" — Estoque: 50 un · +R$ 0,00 adicional
                      </p>
                    </div>
                  </div>
                  <form className="space-y-4" onSubmit={handleCreateVariable}>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Grupo vinculado *</span>
                      <Select
                        value={variableGroupId}
                        onChange={(event) => setVariableGroupId(event.target.value)}
                        className="px-4 py-2.5"
                      >
                        {allGroups.map((group) => (
                          <option key={group.id} value={group.id}>{group.productName} / {group.name}</option>
                        ))}
                      </Select>
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Nome da variável *</span>
                      <input
                        value={variableName}
                        onChange={(event) => setVariableName(event.target.value)}
                        placeholder="Ex: Vermelho, Grande, Algodão"
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: `1px solid ${variableName.trim() && variableName.trim().length < 2 ? 'var(--danger, #dc2626)' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                        required
                      />
                      {variableName.trim() && variableName.trim().length < 2 && (
                        <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
                          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          Mínimo de 2 caracteres
                        </p>
                      )}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm font-medium">Preço adicional por unidade (R$)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={variablePrice}
                          onChange={(event) => setVariablePrice(Number(event.target.value))}
                          className="w-full rounded-lg px-4 py-2.5 text-sm"
                          style={{ background: 'var(--input-bg)', border: `1px solid ${variablePrice < 0 ? 'var(--danger, #dc2626)' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                        />
                        {variablePrice < 0 ? (
                          <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
                            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                            Não pode ser negativo
                          </p>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                            Valor somado ao preço base do produto para cada unidade
                          </p>
                        )}
                      </label>
                      <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm font-medium">Estoque inicial *</span>
                        <input
                          type="number"
                          min={0}
                          value={variableStock}
                          onChange={(event) => setVariableStock(Number(event.target.value))}
                          className="w-full rounded-lg px-4 py-2.5 text-sm"
                          style={{ background: 'var(--input-bg)', border: `1px solid ${variableStock < 0 ? 'var(--danger, #dc2626)' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                          required
                        />
                        {variableStock < 0 && (
                          <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger, #dc2626)' }}>
                            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                            Não pode ser negativo
                          </p>
                        )}
                      </label>
                    </div>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Unidade de medida</span>
                      <Select
                        value={variableUnit}
                        onChange={(event) => setVariableUnit(event.target.value as UnitOfMeasure)}
                        className="px-4 py-2.5"
                      >
                        <option value="un">Unidade (un)</option>
                        <option value="cm²">Centímetro quadrado (cm²)</option>
                        <option value="m²">Metro quadrado (m²)</option>
                        <option value="kg">Quilograma (kg)</option>
                        <option value="g">Grama (g)</option>
                        <option value="l">Litro (l)</option>
                        <option value="ml">Mililitro (ml)</option>
                        <option value="m">Metro (m)</option>
                        <option value="cm">Centímetro (cm)</option>
                      </Select>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Define como o estoque é contado e exibido
                      </p>
                    </label>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}
                      type="submit"
                    >
                      Criar variável
                    </button>
                  </form>
                </div>
              )}
            </div>
          </DraggableSection>
        )}

        {/* ============================================ */}
        {/* MODAL: Editar Variável */}
        {/* ============================================ */}
        {editingVariable ? createPortal(
          <div className="modal-overlay" onClick={() => setEditingVariable(null)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '1rem' }}>
              <div
                className="modal-content rounded-xl p-6 shadow-2xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', maxHeight: '90vh', width: '100%', maxWidth: '28rem', overflowY: 'auto', overscrollBehavior: 'contain' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Editar variável</p>
                    <h3 className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{editingVariable.name}</h3>
                  </div>
                  <button type="button" onClick={() => setEditingVariable(null)}
                    className="rounded-lg p-2 transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
                <form className="space-y-4" onSubmit={handleSubmitVariableUpdate}>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Nome</span>
                    <input
                      value={editVariableName}
                      onChange={(event) => setEditVariableName(event.target.value)}
                      className="w-full rounded-lg px-4 py-2.5 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Preço adicional por unidade</span>
                      <input
                        type="number"
                        step={0.01}
                        min={0}
                        value={editVariablePrice}
                        onChange={(event) => setEditVariablePrice(Number(event.target.value))}
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        +R$ {editVariablePrice.toFixed(2)} por unidade sobre o preço base
                      </p>
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Estoque</span>
                      <input
                        type="number"
                        min={0}
                        value={editVariableStock}
                        onChange={(event) => setEditVariableStock(Number(event.target.value))}
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                    </label>
                  </div>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Unidade de medida</span>
                    <Select
                      value={editVariableUnit}
                      onChange={(event) => setEditVariableUnit(event.target.value as UnitOfMeasure)}
                      className="px-4 py-2.5"
                    >
                      <option value="un">Unidade (un)</option>
                      <option value="cm²">Centímetro quadrado (cm²)</option>
                      <option value="m²">Metro quadrado (m²)</option>
                      <option value="kg">Quilograma (kg)</option>
                      <option value="g">Grama (g)</option>
                      <option value="l">Litro (l)</option>
                      <option value="ml">Mililitro (ml)</option>
                      <option value="m">Metro (m)</option>
                      <option value="cm">Centímetro (cm)</option>
                    </Select>
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingVariable(null)}
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
          </div>
        , document.body) : null}

        {/* ============================================ */}
        {/* MODAL: Editar Produto */}
        {/* ============================================ */}
        {editingProduct ? createPortal(
          <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '1rem' }}>
              <div
                className="modal-content rounded-xl p-6 shadow-2xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', maxHeight: '90vh', width: '100%', maxWidth: '28rem', overflowY: 'auto', overscrollBehavior: 'contain' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Editar produto</p>
                    <h3 className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{editingProduct.name}</h3>
                  </div>
                  <button type="button" onClick={() => setEditingProduct(null)}
                    className="rounded-lg p-2 transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
                <form className="space-y-4" onSubmit={handleSubmitProductUpdate}>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Nome</span>
                    <input
                      value={editProductName}
                      onChange={(event) => setEditProductName(event.target.value)}
                      className="w-full rounded-lg px-4 py-2.5 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    />
                  </label>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Preço base (R$)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editProductPrice}
                      onChange={(event) => setEditProductPrice(Number(event.target.value))}
                      className="w-full rounded-lg px-4 py-2.5 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    />
                  </label>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Margem de lucro (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={editProductMargin}
                      onChange={(event) => setEditProductMargin(Number(event.target.value))}
                      className="w-full rounded-lg px-4 py-2.5 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    />
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      {editProductMargin}% — Preço final: R$ {(editProductPrice * (1 + editProductMargin / 100)).toFixed(2)}
                    </p>
                  </label>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Descrição</span>
                    <textarea
                      value={editProductDescription}
                      onChange={(event) => setEditProductDescription(event.target.value)}
                      rows={2}
                      className="w-full rounded-lg px-4 py-2.5 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    />
                  </label>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Imagem do produto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setEditProductImage(String(reader.result || ''));
                        reader.readAsDataURL(file);
                      }}
                      className="w-full rounded-lg px-4 py-2.5 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    />
                    {editProductImage && <p className="text-xs" style={{ color: 'var(--success)' }}>Imagem carregada</p>}
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setEditingProduct(null)}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                      Cancelar
                    </button>
                    <button type="submit"
                      className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}>
                      Salvar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        , document.body) : null}

        {/* ============================================ */}
        {/* MODAL: Editar Grupo */}
        {/* ============================================ */}
        {editingGroup ? createPortal(
          <div className="modal-overlay" onClick={() => setEditingGroup(null)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '1rem' }}>
              <div
                className="modal-content rounded-xl p-6 shadow-2xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', maxHeight: '90vh', width: '100%', maxWidth: '28rem', overflowY: 'auto', overscrollBehavior: 'contain' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Editar grupo</p>
                    <h3 className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{editingGroup.name}</h3>
                  </div>
                  <button type="button" onClick={() => setEditingGroup(null)}
                    className="rounded-lg p-2 transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
                <form className="space-y-4" onSubmit={handleSubmitGroupUpdate}>
                  <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-sm font-medium">Nome</span>
                    <input
                      value={editGroupName}
                      onChange={(event) => setEditGroupName(event.target.value)}
                      className="w-full rounded-lg px-4 py-2.5 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Limite de atenção</span>
                      <input
                        type="number"
                        min={0}
                        value={editGroupWatchAlert}
                        onChange={(event) => setEditGroupWatchAlert(Number(event.target.value))}
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                    </label>
                    <label className="block space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="text-sm font-medium">Limite crítico</span>
                      <input
                        type="number"
                        min={0}
                        value={editGroupCriticalAlert}
                        onChange={(event) => setEditGroupCriticalAlert(Number(event.target.value))}
                        className="w-full rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setEditingGroup(null)}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                      Cancelar
                    </button>
                    <button type="submit"
                      className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}>
                      Salvar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        , document.body) : null}
      </div>
    </ProtectedPage>
  );
}

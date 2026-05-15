'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

const DEFAULT_WATCH_STOCK_ALERT = 30;
const DEFAULT_CRITICAL_STOCK_ALERT = 10;

interface VariableOption {
  id: string;
  name: string;
  additionalPrice: number;
  stock: number;
  groupId: string;
}

interface GroupOption {
  id: string;
  name: string;
  productId: string;
  watchStockAlert?: number;
  criticalStockAlert?: number;
  variables: VariableOption[];
}

interface ProductOption {
  id: string;
  name: string;
  basePrice: number;
  description?: string;
  imageUrl?: string;
  groups: GroupOption[];
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<ProductOption[]>([]);
  const [message, setMessage] = useState('');
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState(0);
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
  const [activeForm, setActiveForm] = useState<'product' | 'group' | 'variable'>('product');
  const [editingVariable, setEditingVariable] = useState<VariableOption | null>(null);
  const [editVariableName, setEditVariableName] = useState('');
  const [editVariablePrice, setEditVariablePrice] = useState(0);
  const [editVariableStock, setEditVariableStock] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductOption | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editProductPrice, setEditProductPrice] = useState(0);
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editProductImage, setEditProductImage] = useState('');
  const [editingGroup, setEditingGroup] = useState<GroupOption | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupWatchAlert, setEditGroupWatchAlert] = useState(DEFAULT_WATCH_STOCK_ALERT);
  const [editGroupCriticalAlert, setEditGroupCriticalAlert] = useState(DEFAULT_CRITICAL_STOCK_ALERT);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageTab, setPageTab] = useState<'list' | 'create'>('list');

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
    const response = await fetch('/api/inventory', {
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    const list = data.inventory || [];
    setInventory(list);
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
    const response = await fetch('/api/inventory/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name: productName, basePrice: productPrice, description: productDescription, imageUrl: productImage }),
    });
    const result = await safeJson(response);
    if (response.ok) {
      setMessage(result.message);
      setProductName('');
      setProductPrice(0);
      setProductDescription('');
      setProductImage('');
      await loadInventory();
    } else {
      setMessage(result.error || 'Erro ao criar produto.');
    }
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (groupCriticalAlert > groupWatchAlert) {
      setMessage('O limite crítico deve ser menor ou igual ao limite de atenção.');
      return;
    }
    const response = await fetch('/api/inventory/group', {
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
      setMessage(result.error || 'Erro ao criar grupo.');
    }
  }

  async function handleCreateVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/inventory/variable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ groupId: variableGroupId, name: variableName, additionalPrice: variablePrice, stock: variableStock }),
    });
    const result = await safeJson(response);
    if (response.ok) {
      setMessage(result.message);
      setVariableName('');
      setVariablePrice(0);
      setVariableStock(0);
      await loadInventory();
    } else {
      setMessage(result.error || 'Erro ao criar variável.');
    }
  }

  function handleUpdateProduct(product: ProductOption) {
    setEditingProduct(product);
    setEditProductName(product.name);
    setEditProductPrice(product.basePrice);
    setEditProductDescription(product.description || '');
    setEditProductImage(product.imageUrl || '');
  }

  async function handleSubmitProductUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    const response = await fetch('/api/inventory/product', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingProduct.id,
        name: editProductName,
        basePrice: editProductPrice,
        description: editProductDescription,
        imageUrl: editProductImage,
      }),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.error || 'Produto atualizado.');
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
    setMessage(result.message || result.error || 'Operação concluída.');
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
    const response = await fetch('/api/inventory/group', {
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
    setMessage(result.message || result.error || 'Grupo atualizado.');
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
    setMessage(result.message || result.error || 'Operação concluída.');
    if (response.ok) await loadInventory();
  }

  async function handleUpdateVariable(variable: VariableOption) {
    setEditingVariable(variable);
    setEditVariableName(variable.name);
    setEditVariablePrice(variable.additionalPrice);
    setEditVariableStock(variable.stock);
  }

  async function handleSubmitVariableUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVariable) return;
    const response = await fetch('/api/inventory/variable', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingVariable.id,
        name: editVariableName,
        additionalPrice: editVariablePrice,
        stock: editVariableStock,
      }),
    });
    const result = await safeJson(response);
    setMessage(result.message || result.error || 'Variável atualizada.');
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
    setMessage(result.message || result.error || 'Operação concluída.');
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
        <PageHeader title="Estoque" description="Gestão de estoque com grupos e variáveis configuráveis dinamicamente." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {/* Toast de mensagem */}
        {message ? (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')} className="ml-3 text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
        ) : null}

        {/* Cards de resumo */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produtos</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalProducts}</p>
            <p className="text-xs text-slate-400">{stats.totalGroups} grupos · {stats.totalVariables} variáveis</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estoque total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalStock.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-slate-400">unidades em todas as variáveis</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estoque crítico</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{stats.criticalCount}</p>
            <p className="text-xs text-rose-400">variáveis abaixo do limite</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Em atenção</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{stats.watchCount}</p>
            <p className="text-xs text-amber-400">variáveis próximas do limite</p>
          </div>
        </div>

        {/* Tabs de navegação */}
        <div className="mb-6 inline-flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-muted)' }}>
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
            📦 Produtos
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
            ➕ Adicionar novo
          </button>
        </div>

        {/* ============================================ */}
        {/* ABA: LISTA DE PRODUTOS */}
        {/* ============================================ */}
        {pageTab === 'list' && (
          <DraggableSection pagePath={PAGE_PATH} section={sections[0]} index={0} totalSections={sections.length}>
            <div className="space-y-4">
              {/* Busca */}
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar produto, grupo ou variável..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                />
              </div>

              {filteredInventory.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                  <p className="text-slate-500">{searchTerm ? 'Nenhum resultado encontrado.' : 'Nenhum produto cadastrado.'}</p>
                </div>
              ) : (
                filteredInventory.map((product) => {
                  const isExpanded = expandedProduct === product.id;
                  const productTotalStock = product.groups.reduce((s, g) => s + g.variables.reduce((vs, v) => vs + v.stock, 0), 0);
                  const productCritical = product.groups.reduce((s, g) => s + g.variables.filter(v => getGroupStockStatus(g, v.stock) === 'critical').length, 0);

                  return (
                    <div key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                      {/* Header do produto - clicável para expandir */}
                      <div
                        className="flex cursor-pointer items-center gap-4 p-5 transition-colors hover:bg-slate-50"
                        onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedProduct(isExpanded ? null : product.id); }}
                      >
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-14 w-14 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
                        ) : (
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-400">
                            📦
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900 truncate">{product.name}</h3>
                            {productCritical > 0 && (
                              <span className="flex-shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                                {productCritical} crítico{productCritical > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 truncate">{product.description || 'Sem descrição'}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>R$ {product.basePrice.toFixed(2)} base</span>
                            <span>·</span>
                            <span>{product.groups.length} grupo{product.groups.length !== 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span>{productTotalStock.toLocaleString('pt-BR')} un.</span>
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
                            className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Grupos e variáveis - expansível */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 px-5 pb-5">
                          {product.groups.length === 0 ? (
                            <p className="py-4 text-sm text-slate-400">Nenhum grupo cadastrado.</p>
                          ) : (
                            <div className="mt-4 space-y-3">
                              {product.groups.map((group) => (
                                <div key={group.id} className="rounded-xl border border-slate-200 overflow-hidden">
                                  {/* Header do grupo */}
                                  <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <h4 className="font-semibold text-slate-900">{group.name}</h4>
                                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                                        {group.variables.length} variáve{group.variables.length !== 1 ? 'is' : 'l'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-400">
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
                                      <p className="text-sm text-slate-400">Nenhuma variável cadastrada.</p>
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {group.variables.map((variable) => {
                                          const status = getGroupStockStatus(group, variable.stock);
                                          return (
                                            <div
                                              key={variable.id}
                                              className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                                                status === 'critical'
                                                  ? 'border-rose-200 bg-rose-50'
                                                  : status === 'watch'
                                                  ? 'border-amber-200 bg-amber-50'
                                                  : 'border-slate-200 bg-white'
                                              }`}
                                            >
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <p className="font-medium text-slate-900 truncate">{variable.name}</p>
                                                  {status === 'critical' && (
                                                    <span className="flex-shrink-0 rounded-full bg-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">!</span>
                                                  )}
                                                  {status === 'watch' && (
                                                    <span className="flex-shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">⚠</span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                  <span className={`font-semibold ${
                                                    status === 'critical' ? 'text-rose-600' : status === 'watch' ? 'text-amber-600' : 'text-slate-700'
                                                  }`}>
                                                    {variable.stock} un.
                                                  </span>
                                                  {variable.additionalPrice > 0 && (
                                                    <span>+R$ {variable.additionalPrice.toFixed(2)}</span>
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
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {/* Tabs */}
              <div
                className="mb-6 inline-flex gap-1 rounded-xl p-1"
                style={{ background: 'var(--surface-muted)' }}
              >
                {[
                  { key: 'product' as const, label: '📦 Produto', desc: 'Base' },
                  { key: 'group' as const, label: '📁 Grupo', desc: 'Categoria' },
                  { key: 'variable' as const, label: '🏷️ Variável', desc: 'Item' },
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
                    <h3 className="text-lg font-bold text-slate-900">Novo produto base</h3>
                    <p className="text-sm text-slate-500">Crie um produto que servirá como base para grupos e variáveis.</p>
                  </div>
                  <form className="space-y-4" onSubmit={handleCreateProduct}>
                    <label className="block space-y-1.5 text-slate-700">
                      <span className="text-sm font-medium">Nome do produto *</span>
                      <input
                        value={productName}
                        onChange={(event) => setProductName(event.target.value)}
                        placeholder="Ex: Sacola TNT"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                        required
                      />
                    </label>
                    <label className="block space-y-1.5 text-slate-700">
                      <span className="text-sm font-medium">Preço base (R$) *</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={productPrice}
                        onChange={(event) => setProductPrice(Number(event.target.value))}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                        required
                      />
                    </label>
                    <label className="block space-y-1.5 text-slate-700">
                      <span className="text-sm font-medium">Descrição</span>
                      <textarea
                        value={productDescription}
                        onChange={(event) => setProductDescription(event.target.value)}
                        placeholder="Descrição opcional do produto..."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                        rows={2}
                      />
                    </label>
                    <label className="block space-y-1.5 text-slate-700">
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
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                      />
                      {productImage && <p className="text-xs text-emerald-600">✓ Imagem carregada</p>}
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
                    <h3 className="text-lg font-bold text-slate-900">Novo grupo</h3>
                    <p className="text-sm text-slate-500">Grupos organizam variáveis dentro de um produto (ex: Cor, Tamanho).</p>
                  </div>
                  <form className="space-y-4" onSubmit={handleCreateGroup}>
                    <label className="block space-y-1.5 text-slate-700">
                      <span className="text-sm font-medium">Produto vinculado *</span>
                      <select
                        value={groupProductId}
                        onChange={(event) => setGroupProductId(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                      >
                        {inventory.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1.5 text-slate-700">
                      <span className="text-sm font-medium">Nome do grupo *</span>
                      <input
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value)}
                        placeholder="Ex: Cor, Tamanho, Material"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                        required
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5 text-slate-700">
                        <span className="text-sm font-medium">Limite de atenção</span>
                        <input
                          type="number"
                          min={0}
                          value={groupWatchAlert}
                          onChange={(event) => setGroupWatchAlert(Number(event.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                        />
                      </label>
                      <label className="block space-y-1.5 text-slate-700">
                        <span className="text-sm font-medium">Limite crítico</span>
                        <input
                          type="number"
                          min={0}
                          value={groupCriticalAlert}
                          onChange={(event) => setGroupCriticalAlert(Number(event.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
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
                    <h3 className="text-lg font-bold text-slate-900">Nova variável</h3>
                    <p className="text-sm text-slate-500">Variáveis são as opções dentro de um grupo (ex: Vermelho, Azul).</p>
                  </div>
                  <form className="space-y-4" onSubmit={handleCreateVariable}>
                    <label className="block space-y-1.5 text-slate-700">
                      <span className="text-sm font-medium">Grupo vinculado *</span>
                      <select
                        value={variableGroupId}
                        onChange={(event) => setVariableGroupId(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                      >
                        {allGroups.map((group) => (
                          <option key={group.id} value={group.id}>{group.productName} / {group.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1.5 text-slate-700">
                      <span className="text-sm font-medium">Nome da variável *</span>
                      <input
                        value={variableName}
                        onChange={(event) => setVariableName(event.target.value)}
                        placeholder="Ex: Vermelho, Grande, Algodão"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                        required
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5 text-slate-700">
                        <span className="text-sm font-medium">Preço adicional (R$)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={variablePrice}
                          onChange={(event) => setVariablePrice(Number(event.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                        />
                      </label>
                      <label className="block space-y-1.5 text-slate-700">
                        <span className="text-sm font-medium">Estoque inicial *</span>
                        <input
                          type="number"
                          min={0}
                          value={variableStock}
                          onChange={(event) => setVariableStock(Number(event.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                          required
                        />
                      </label>
                    </div>
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
        {editingVariable ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingVariable(null)}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Editar variável</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{editingVariable.name}</h3>
                </div>
                <button type="button" onClick={() => setEditingVariable(null)}
                  className="rounded-lg p-2 transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <form className="space-y-4" onSubmit={handleSubmitVariableUpdate}>
                <label className="block space-y-1.5 text-slate-700">
                  <span className="text-sm font-medium">Nome</span>
                  <input
                    value={editVariableName}
                    onChange={(event) => setEditVariableName(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5 text-slate-700">
                    <span className="text-sm font-medium">Preço adicional</span>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      value={editVariablePrice}
                      onChange={(event) => setEditVariablePrice(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block space-y-1.5 text-slate-700">
                    <span className="text-sm font-medium">Estoque</span>
                    <input
                      type="number"
                      min={0}
                      value={editVariableStock}
                      onChange={(event) => setEditVariableStock(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                    />
                  </label>
                </div>
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
        ) : null}

        {/* ============================================ */}
        {/* MODAL: Editar Produto */}
        {/* ============================================ */}
        {editingProduct ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingProduct(null)}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Editar produto</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{editingProduct.name}</h3>
                </div>
                <button type="button" onClick={() => setEditingProduct(null)}
                  className="rounded-lg p-2 transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <form className="space-y-4" onSubmit={handleSubmitProductUpdate}>
                <label className="block space-y-1.5 text-slate-700">
                  <span className="text-sm font-medium">Nome</span>
                  <input
                    value={editProductName}
                    onChange={(event) => setEditProductName(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                </label>
                <label className="block space-y-1.5 text-slate-700">
                  <span className="text-sm font-medium">Preço base (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editProductPrice}
                    onChange={(event) => setEditProductPrice(Number(event.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                </label>
                <label className="block space-y-1.5 text-slate-700">
                  <span className="text-sm font-medium">Descrição</span>
                  <textarea
                    value={editProductDescription}
                    onChange={(event) => setEditProductDescription(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                </label>
                <label className="block space-y-1.5 text-slate-700">
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
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                  {editProductImage && <p className="text-xs text-emerald-600">✓ Imagem carregada</p>}
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
        ) : null}

        {/* ============================================ */}
        {/* MODAL: Editar Grupo */}
        {/* ============================================ */}
        {editingGroup ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingGroup(null)}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Editar grupo</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{editingGroup.name}</h3>
                </div>
                <button type="button" onClick={() => setEditingGroup(null)}
                  className="rounded-lg p-2 transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <form className="space-y-4" onSubmit={handleSubmitGroupUpdate}>
                <label className="block space-y-1.5 text-slate-700">
                  <span className="text-sm font-medium">Nome</span>
                  <input
                    value={editGroupName}
                    onChange={(event) => setEditGroupName(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5 text-slate-700">
                    <span className="text-sm font-medium">Limite de atenção</span>
                    <input
                      type="number"
                      min={0}
                      value={editGroupWatchAlert}
                      onChange={(event) => setEditGroupWatchAlert(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block space-y-1.5 text-slate-700">
                    <span className="text-sm font-medium">Limite crítico</span>
                    <input
                      type="number"
                      min={0}
                      value={editGroupCriticalAlert}
                      onChange={(event) => setEditGroupCriticalAlert(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
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
        ) : null}
      </div>
    </ProtectedPage>
  );
}

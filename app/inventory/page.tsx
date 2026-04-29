'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';

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

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Estoque" description="Gestão de estoque com grupos e variáveis configuráveis dinamicamente. Aqui você pode adicionar produtos, grupos e variáveis." />

        {message ? (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-emerald-50 p-4 text-slate-800">{message}</div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={() => void loadInventory()}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Atualizar estoque
              </button>
            </div>
            {inventory.map((product) => (
              <div key={product.id} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Produto base</p>
                    <h3 className="text-2xl font-semibold text-slate-900">{product.name}</h3>
                    <p className="mt-2 text-slate-600">{product.description}</p>
                  </div>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-20 w-20 rounded-2xl object-cover border border-slate-200" />
                  ) : null}
                  <div className="rounded-3xl bg-slate-50 px-4 py-2 text-slate-700">
                    Preço base: R$ {product.basePrice.toFixed(2)}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleUpdateProduct(product)}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
                  >
                    Atualizar produto
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteProduct(product)}
                    className="rounded-2xl bg-rose-600 px-4 py-2 text-sm text-white transition hover:bg-rose-700"
                  >
                    Excluir produto
                  </button>
                </div>

                <div className="mt-6 space-y-6">
                  {product.groups.map((group) => (
                    <div key={group.id} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">{group.name}</h4>
                          <p className="text-xs text-slate-500">
                            Atenção: {group.watchStockAlert ?? DEFAULT_WATCH_STOCK_ALERT} | Crítico:{' '}
                            {group.criticalStockAlert ?? DEFAULT_CRITICAL_STOCK_ALERT}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUpdateGroup(group)}
                            className="rounded-2xl border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                          >
                            Atualizar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteGroup(group)}
                            className="rounded-2xl bg-rose-600 px-3 py-1 text-xs text-white transition hover:bg-rose-700"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {group.variables.map((variable) => (
                          <div key={variable.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <p className="font-semibold text-slate-900">{variable.name}</p>
                            <p className="text-sm text-slate-600">Preço adicional: R$ {variable.additionalPrice.toFixed(2)}</p>
                            <p className="text-sm text-slate-600">Estoque: {variable.stock}</p>
                            {getGroupStockStatus(group, variable.stock) === 'critical' ? (
                              <p className="mt-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">Estoque crítico</p>
                            ) : null}
                            {getGroupStockStatus(group, variable.stock) === 'watch' ? (
                              <p className="mt-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Ficar de olho</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleUpdateVariable(variable)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                              >
                                Atualizar estoque
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteVariable(variable)}
                                className="rounded-2xl bg-rose-600 px-3 py-1 text-xs text-white transition hover:bg-rose-700"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setActiveForm('product')} className={`rounded-2xl px-4 py-2 text-sm ${activeForm === 'product' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  Produto
                </button>
                <button type="button" onClick={() => setActiveForm('group')} className={`rounded-2xl px-4 py-2 text-sm ${activeForm === 'group' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  Grupo
                </button>
                <button type="button" onClick={() => setActiveForm('variable')} className={`rounded-2xl px-4 py-2 text-sm ${activeForm === 'variable' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  Variável
                </button>
              </div>
              {activeForm === 'product' ? (
              <>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">Adicionar produto base</h3>
              <form className="mt-6 space-y-4" onSubmit={handleCreateProduct}>
                <label className="block text-slate-700">
                  Nome do produto
                  <input
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <label className="block text-slate-700">
                  Preço base
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={productPrice}
                    onChange={(event) => setProductPrice(Number(event.target.value))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <label className="block text-slate-700">
                  Descrição
                  <textarea
                    value={productDescription}
                    onChange={(event) => setProductDescription(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    rows={3}
                  />
                </label>
                <label className="block text-slate-700">
                  Imagem do produto (obrigatório)
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
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <button className="inline-flex h-12 items-center justify-center rounded-3xl bg-slate-900 px-6 text-white transition hover:bg-slate-700" type="submit">
                  Criar produto
                </button>
              </form>
              </>
              ) : null}
              {activeForm === 'group' ? (
              <>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">Adicionar grupo</h3>
              <form className="mt-6 space-y-4" onSubmit={handleCreateGroup}>
                <label className="block text-slate-700">
                  Produto vinculado
                  <select
                    value={groupProductId}
                    onChange={(event) => setGroupProductId(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    {inventory.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-slate-700">
                  Nome do grupo
                  <input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <label className="block text-slate-700">
                  Limite de atenção
                  <input
                    type="number"
                    min={0}
                    value={groupWatchAlert}
                    onChange={(event) => setGroupWatchAlert(Number(event.target.value))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <label className="block text-slate-700">
                  Limite crítico
                  <input
                    type="number"
                    min={0}
                    value={groupCriticalAlert}
                    onChange={(event) => setGroupCriticalAlert(Number(event.target.value))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <button className="inline-flex h-12 items-center justify-center rounded-3xl bg-slate-900 px-6 text-white transition hover:bg-slate-700" type="submit">
                  Criar grupo
                </button>
              </form>
              </>
              ) : null}
              {activeForm === 'variable' ? (
              <>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">Adicionar variável / estoque</h3>
              <form className="mt-6 space-y-4" onSubmit={handleCreateVariable}>
                <label className="block text-slate-700">
                  Grupo vinculado
                  <select
                    value={variableGroupId}
                    onChange={(event) => setVariableGroupId(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    {allGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.productName} / {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-slate-700">
                  Nome da variável
                  <input
                    value={variableName}
                    onChange={(event) => setVariableName(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <label className="block text-slate-700">
                  Preço adicional
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={variablePrice}
                    onChange={(event) => setVariablePrice(Number(event.target.value))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <label className="block text-slate-700">
                  Estoque inicial
                  <input
                    type="number"
                    min={0}
                    value={variableStock}
                    onChange={(event) => setVariableStock(Number(event.target.value))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
                <button className="inline-flex h-12 items-center justify-center rounded-3xl bg-slate-900 px-6 text-white transition hover:bg-slate-700" type="submit">
                  Criar variável
                </button>
              </form>
              </>
              ) : null}
            </div>
          </div>
        </section>
        {editingVariable ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">Atualizar variável</h3>
              <form className="mt-4 space-y-4" onSubmit={handleSubmitVariableUpdate}>
                <label className="block text-slate-700">
                  Nome
                  <input
                    value={editVariableName}
                    onChange={(event) => setEditVariableName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Preço adicional
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={editVariablePrice}
                    onChange={(event) => setEditVariablePrice(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Estoque
                  <input
                    type="number"
                    min={0}
                    value={editVariableStock}
                    onChange={(event) => setEditVariableStock(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingVariable(null)}
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
        {editingProduct ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">Atualizar produto</h3>
              <form className="mt-4 space-y-4" onSubmit={handleSubmitProductUpdate}>
                <label className="block text-slate-700">
                  Nome
                  <input
                    value={editProductName}
                    onChange={(event) => setEditProductName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Preço base
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editProductPrice}
                    onChange={(event) => setEditProductPrice(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Descrição
                  <textarea
                    value={editProductDescription}
                    onChange={(event) => setEditProductDescription(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Imagem (URL/base64)
                  <input
                    value={editProductImage}
                    onChange={(event) => setEditProductImage(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingProduct(null)} className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700">
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
        {editingGroup ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">Atualizar grupo</h3>
              <form className="mt-4 space-y-4" onSubmit={handleSubmitGroupUpdate}>
                <label className="block text-slate-700">
                  Nome
                  <input
                    value={editGroupName}
                    onChange={(event) => setEditGroupName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Limite de atenção
                  <input
                    type="number"
                    min={0}
                    value={editGroupWatchAlert}
                    onChange={(event) => setEditGroupWatchAlert(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="block text-slate-700">
                  Limite crítico
                  <input
                    type="number"
                    min={0}
                    value={editGroupCriticalAlert}
                    onChange={(event) => setEditGroupCriticalAlert(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingGroup(null)} className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700">
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

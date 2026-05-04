'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateLogoCost, calculateSalePrice, globalConfig } from '../../config/global';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders, getCurrentUser } from '../lib/authClient';
import { Order } from '../../types';

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

interface OrderView extends Order {
  createdByName?: string;
}

export default function SalesPage() {
  const [inventory, setInventory] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariables, setSelectedVariables] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [orderName, setOrderName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');
  const [logoAnalysisResult, setLogoAnalysisResult] = useState<{
    colors: number;
    colorDetails: { hex: string; rgb: { r: number; g: number; b: number }; score: number; pixelFraction: number }[];
    complexity: string;
    description: string;
    source?: string;
  } | null>(null);
  const [logoAnalyzing, setLogoAnalyzing] = useState(false);
  const [logoAnalysisError, setLogoAnalysisError] = useState('');
  const [cartItems, setCartItems] = useState<
    {
      productId: string;
      productName: string;
      quantity: number;
      selectedVariables: { groupId: string; variableId: string; quantity: number }[];
      selectedVariablesLabel: string;
      unitCost: number;
      unitPrice: number;
    }[]
  >([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [orderStatusUpdates, setOrderStatusUpdates] = useState<Record<string, Order['status']>>({});
  const [orderSearch, setOrderSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeSection, setActiveSection] = useState<'search' | 'create'>('search');
  const currentUser = getCurrentUser();

  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      return { error: 'Falha ao interpretar resposta do servidor.' };
    }
  }

  async function loadInventory() {
    try {
      const response = await fetch('/api/inventory', {
        cache: 'no-store',
        headers: getAuthHeaders(),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        setStatusMessage(data.error || 'Falha ao carregar estoque.');
        return;
      }
      const list = data.inventory || [];
      setInventory(list);
      if (list.length > 0) {
        setSelectedProductId((previous) => previous || list[0].id);
      }
    } catch {
      setStatusMessage('Conexão instável ao carregar estoque. Tente atualizar.');
    }
  }

  async function loadOrders() {
    try {
      const response = await fetch('/api/orders', {
        cache: 'no-store',
        headers: getAuthHeaders(),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        setStatusMessage(data.error || 'Falha ao carregar pedidos.');
        return;
      }
      const list = data.orders || [];
      setOrders(list);
      const initialStatuses = list.reduce((acc: Record<string, Order['status']>, order: OrderView) => {
        acc[order.id] = order.status;
        return acc;
      }, {});
      setOrderStatusUpdates(initialStatuses);
    } catch {
      setStatusMessage('Conexão instável ao carregar pedidos. Tente atualizar.');
    }
  }

  useEffect(() => {
    void loadInventory();
    void loadOrders();
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl('');
      setLogoAnalysisResult(null);
      setLogoAnalysisError('');
      return;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

    // Análise de cores da logo (local via sharp, sem dependência externa)
    setLogoAnalyzing(true);
    setLogoAnalysisError('');
    setLogoAnalysisResult(null);

    const analyzeLogo = async () => {
      try {
        const formData = new FormData();
        formData.append('logo', logoFile);

        const response = await fetch('/api/logo-analysis', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          setLogoAnalysisError(data.error || 'Falha na análise da logo.');
          return;
        }

        setLogoAnalysisResult(data);
      } catch {
        setLogoAnalysisError('Erro ao conectar com o serviço de análise.');
      } finally {
        setLogoAnalyzing(false);
      }
    };

    void analyzeLogo();

    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  const selectedProduct = inventory.find((product) => product.id === selectedProductId);
  // Cores reais da análise Vision API (fallback = 1 se ainda não analisou)
  const logoColors = logoAnalysisResult?.colors ?? 1;
  const logoCost = calculateLogoCost(logoColors);

  const selectedVariablesList = useMemo(() => {
    if (!selectedProduct) return [];
    const allVariables = selectedProduct.groups.flatMap((group) => group.variables);
    return allVariables.filter((variable) => (selectedVariables[variable.id] || 0) > 0);
  }, [selectedProduct, selectedVariables]);

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchText = !term || order.id.toLowerCase().includes(term) || order.name.toLowerCase().includes(term);
      if (!matchText) return false;
      const createdAt = new Date(order.createdAt);
      if (fromDate && createdAt < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && createdAt > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [orders, orderSearch, fromDate, toDate]);

  const groupQuantityWarnings = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.groups
      .map((group) => {
        const groupSum = group.variables.reduce((sum, variable) => sum + (selectedVariables[variable.id] || 0), 0);
        return {
          groupId: group.id,
          groupName: group.name,
          sum: groupSum,
          ok: groupSum === quantity,
        };
      })
      .filter((item) => !item.ok);
  }, [selectedProduct, selectedVariables, quantity]);

  const currentItemUnitCost = selectedProduct
    ? selectedProduct.basePrice + selectedVariablesList.reduce((sum, variable) => sum + variable.additionalPrice, 0)
    : 0;
  const currentItemTotalCost = currentItemUnitCost * quantity;
  const cartItemsCost = cartItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const orderCostWithLogo = cartItemsCost + logoCost;
  const salePrice = calculateSalePrice(orderCostWithLogo);

  function handleAddItemToCart() {
    if (!selectedProduct) return;

    const selectedEntries = Object.entries(selectedVariables)
      .filter(([, variableQuantity]) => variableQuantity > 0)
      .map(([variableId, variableQuantity]) => {
        const groupId =
          selectedProduct.groups.find((group) => group.variables.some((variable) => variable.id === variableId))?.id || '';
        return { variableId, groupId, quantity: variableQuantity };
      });

    if (selectedEntries.length === 0) {
      setStatusMessage('Selecione pelo menos uma variável e informe quantidade.');
      return;
    }

    if (groupQuantityWarnings.length > 0) {
      setStatusMessage(`A soma por grupo deve ser igual à quantidade do pedido (${quantity}).`);
      return;
    }

    const selectedVariablesLabel = selectedEntries
      .map((entry) => {
        const variable = selectedProduct.groups.flatMap((group) => group.variables).find((item) => item.id === entry.variableId);
        return `${variable?.name || entry.variableId} x${entry.quantity}`;
      })
      .join(', ');

    setCartItems((previous) => [
      ...previous,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity,
        selectedVariables: selectedEntries,
        selectedVariablesLabel,
        unitCost: currentItemUnitCost,
        unitPrice: calculateSalePrice(currentItemUnitCost),
      },
    ]);
    setSelectedVariables({});
    setQuantity(1);
    setStatusMessage(`Item "${selectedProduct.name}" adicionado ao carrinho.`);
  }

  function handleRemoveCartItem(index: number) {
    setCartItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderName.trim()) {
      setStatusMessage('Informe um nome para o pedido.');
      return;
    }

    if (cartItems.length === 0) {
      setStatusMessage('Adicione pelo menos um item ao carrinho antes de finalizar.');
      return;
    }

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        name: orderName,
        items: cartItems.map((item) => ({
          productId: item.productId,
          selectedVariables: item.selectedVariables,
          quantity: item.quantity,
          unitCost: item.unitCost,
          unitPrice: item.unitPrice,
        })),
        logoColors,
      }),
    });

    const result = await safeJson(response);
    if (response.ok) {
      setStatusMessage('Pedido finalizado com sucesso. Nota fiscal gerada automaticamente.');
      setSelectedVariables({});
      setLogoFile(null);
      setQuantity(1);
      setOrderName('');
      setCartItems([]);
      setOrders((prev) => (result.order ? [result.order, ...prev] : prev));
      setOrderStatusUpdates((prev) => ({ ...prev, [result.order.id]: result.order.status }));
      await loadInventory();
    } else {
      setStatusMessage(result.error || 'Erro ao finalizar pedido.');
    }
  }

  async function handleStatusChange(orderId: string, status: Order['status']) {
    const response = await fetch('/api/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ orderId, status }),
    });

    const data = await safeJson(response);
    if (response.ok) {
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
      setOrderStatusUpdates((prev) => ({ ...prev, [orderId]: status }));
      setStatusMessage('Status do pedido atualizado.');
      await loadInventory();
    } else {
      setStatusMessage(data.error || 'Erro ao atualizar o pedido.');
    }
  }

  async function handleDeleteCancelledOrder(orderId: string) {
    const confirmed = window.confirm('Tem certeza que deseja remover este pedido cancelado? Essa ação não pode ser desfeita.');
    if (!confirmed) return;

    const response = await fetch(`/api/orders?orderId=${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    if (response.ok) {
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      setStatusMessage(data.message || 'Pedido removido com sucesso.');
    } else {
      setStatusMessage(data.error || 'Erro ao remover pedido.');
    }
  }

  return (
    <ProtectedPage allowedRoles={['admin', 'seller']}>
      <div>
        <PageHeader title="Pedidos" description="Fluxo de venda com seleção de produto, variáveis, cálculo automático de preço e gestão de pedidos." />
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('search')}
            className={`rounded-2xl px-4 py-2 text-sm ${activeSection === 'search' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Buscar pedidos
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('create')}
            className={`rounded-2xl px-4 py-2 text-sm ${activeSection === 'create' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Criar pedido
          </button>
        </div>

        {activeSection === 'search' ? (
        <section className="mb-8 rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Pedidos</p>
              <h3 className="text-2xl font-semibold text-slate-900">Últimos pedidos</h3>
            </div>
            <p className="text-sm text-slate-600">Você pode cancelar pedidos ou atualizar o status, dependendo da permissão do seu papel.</p>
          </div>
          <div className="mb-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Buscar por ID ou nome do pedido"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2"
              />
              <label className="text-sm text-slate-600">
                Data inicial
                <input
                  type="date"
                  value={fromDate}
                  aria-label="Data inicial dos pedidos"
                  title="Data inicial dos pedidos"
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2"
                />
              </label>
              <label className="text-sm text-slate-600">
                Data final
                <input
                  type="date"
                  value={toDate}
                  aria-label="Data final dos pedidos"
                  title="Data final dos pedidos"
                  onChange={(event) => setToDate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2"
                />
              </label>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum pedido registrado ainda.</p>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="rounded-3xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{order.name || `Pedido ${order.id}`}</p>
                      <p className="text-sm text-slate-500">ID: {order.id}</p>
                      <p className="text-sm text-slate-500">Criado por: {order.createdByName || order.userId}</p>
                      <p className="text-sm text-slate-500">Data: {new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">Status: {order.status}</span>
                      {currentUser?.role === 'admin' ? (
                        <>
                          <select
                            value={orderStatusUpdates[order.id] || order.status}
                            onChange={(event) => handleStatusChange(order.id, event.target.value as Order['status'])}
                            aria-label={`Status do pedido ${order.name || order.id}`}
                            title="Status do pedido"
                            className="rounded-3xl border border-slate-200 bg-white px-4 py-2"
                          >
                            <option value="pending">Pendente</option>
                            <option value="completed">Concluído</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                          {order.status === 'cancelled' ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteCancelledOrder(order.id)}
                              className="rounded-3xl bg-rose-600 px-4 py-2 text-white transition hover:bg-rose-700"
                            >
                              Remover cancelado
                            </button>
                          ) : null}
                        </>
                      ) : order.status !== 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'cancelled')}
                          className="rounded-3xl bg-amber-500 px-4 py-2 text-white transition hover:bg-amber-600"
                        >
                          Cancelar pedido
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleDeleteCancelledOrder(order.id)}
                          className="rounded-3xl bg-rose-600 px-4 py-2 text-white transition hover:bg-rose-700"
                        >
                          Remover cancelado
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        ) : null}

        {activeSection === 'create' ? (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-white p-8 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-slate-700 md:col-span-2">
              <span>Nome do pedido</span>
              <input
                value={orderName}
                onChange={(event) => setOrderName(event.target.value)}
                placeholder="Ex: Sacola - 10 materiais"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-slate-700">
              <span>Produto base</span>
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                aria-label="Produto base"
                title="Seleção de produto base"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                {inventory.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-slate-700">
              <span>Quantidade</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
          </div>

          {selectedProduct ? (
            <div className="space-y-6">
              {selectedProduct.groups.map((group) => (
                <div key={group.id} className="rounded-3xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{group.name}</p>
                  <p className="mt-1 text-xs text-slate-500">A soma das variáveis deste grupo deve ser igual a {quantity}.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {group.variables.map((variable) => (
                      <div key={variable.id} className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${variable.name}`}
                          checked={(selectedVariables[variable.id] || 0) > 0}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedVariables((state) => ({ ...state, [variable.id]: state[variable.id] || 1 }));
                            } else {
                              setSelectedVariables((state) => ({ ...state, [variable.id]: 0 }));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{variable.name}</p>
                          <p className="text-sm text-slate-600">R$ {variable.additionalPrice.toFixed(2)}</p>
                          <p className="text-xs text-slate-500">Estoque: {variable.stock}</p>
                        </div>
                        {(selectedVariables[variable.id] || 0) > 0 ? (
                          <input
                            type="number"
                            min={1}
                            max={variable.stock}
                            value={selectedVariables[variable.id] || 1}
                            aria-label={`Quantidade da variável ${variable.name}`}
                            placeholder="Qtd"
                            onChange={(event) =>
                              setSelectedVariables((state) => ({
                                ...state,
                                [variable.id]: Math.max(1, Number(event.target.value) || 1),
                              }))
                            }
                            className="w-20 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-sm"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {groupQuantityWarnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {groupQuantityWarnings.map((warning) => (
                <p key={warning.groupId}>
                  Grupo "{warning.groupName}" soma {warning.sum}; deve ser {quantity}.
                </p>
              ))}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Upload de logo</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff"
              aria-label="Upload de logo"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setLogoFile(file);
              }}
              className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3"
            />
            {logoAnalyzing ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analisando logo localmente…
              </div>
            ) : logoAnalysisError ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {logoAnalysisError}
              </div>
            ) : logoAnalysisResult ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-800">
                    ✓ Análise concluída — {logoColors} {logoColors === 1 ? 'cor dominante' : 'cores dominantes'} detectada{logoColors === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">{logoAnalysisResult.description}</p>
                  <p className="mt-1 text-xs text-emerald-700">Complexidade: {logoAnalysisResult.complexity}</p>
                  <p className="mt-1 text-xs text-emerald-600">
                    {logoAnalysisResult.source === 'google-vision' ? '🔍 Google Cloud Vision AI' : '🎨 Análise local (sharp)'}
                  </p>
                </div>
                {logoAnalysisResult.colorDetails.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {logoAnalysisResult.colorDetails.map((color, i) => (
                      <div
                        key={`${color.hex}-${i}`}
                        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs"
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-slate-300"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="font-mono text-slate-600">{color.hex}</span>
                        <span className="text-slate-400">{(color.pixelFraction * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Envie uma imagem para análise automática de cores. Cada cor detectada custa R$ {globalConfig.logoPricePerColor}.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Carrinho do pedido</p>
              <p className="text-sm text-slate-600">{cartItems.length} item(ns)</p>
            </div>
            {cartItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nenhum item adicionado.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {cartItems.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="font-semibold text-slate-900">{item.productName}</p>
                    <p className="text-sm text-slate-600">Qtd: {item.quantity}</p>
                    <p className="text-sm text-slate-600">Variáveis: {item.selectedVariablesLabel}</p>
                    <p className="text-sm text-slate-600">Subtotal: R$ {(item.unitCost * item.quantity).toFixed(2)}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveCartItem(index)}
                      className="mt-2 rounded-2xl bg-rose-600 px-3 py-1 text-xs text-white transition hover:bg-rose-700"
                    >
                      Remover item
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddItemToCart}
            className="inline-flex h-12 items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-slate-800 transition hover:bg-slate-100"
          >
            Adicionar item ao carrinho
          </button>

          <div className="grid gap-6 md:grid-cols-[1fr_280px]">
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center justify-between text-slate-700">
                <span>Custo do item atual</span>
                <span>R$ {currentItemTotalCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Total dos itens no carrinho</span>
                <span>R$ {cartItemsCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Custo da logo ({logoColors} {logoColors === 1 ? 'cor' : 'cores'})</span>
                <span>R$ {logoCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Preço total</span>
                <span>R$ {salePrice.toFixed(2)}</span>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Prévia (base preparada para IA)</p>
              {selectedProduct?.imageUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200">
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-48 w-full object-cover" />
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Logo enviada" className="absolute bottom-3 right-3 h-14 w-14 rounded-md border border-white object-cover shadow" />
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Produto sem imagem.</p>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Estrutura pronta: imagem base do produto + logo + variáveis selecionadas para futura composição por IA.
              </p>
            </div>
          </div>

          <button className="inline-flex h-12 items-center justify-center rounded-3xl bg-slate-900 px-6 text-white transition hover:bg-slate-700" type="submit">
            Finalizar Pedido
          </button>
          {statusMessage ? <p className="text-sm text-slate-600">{statusMessage}</p> : null}
        </form>
        ) : null}
      </div>
    </ProtectedPage>
  );
}

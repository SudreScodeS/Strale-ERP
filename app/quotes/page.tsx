'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateSalePrice, globalConfig, applyServerConfig } from '../../config/global';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders, getCurrentUser } from '../lib/authClient';
import { Quote } from '../../types';

const QUOTES_FORM_KEY = 'elitium-quotes-form';

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
  groups: GroupOption[];
}

interface QuoteView extends Quote {
  createdByName?: string;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  selectedVariables: { groupId: string; variableId: string; quantity: number }[];
  selectedVariablesLabel: string;
  unitCost: number;
  unitPrice: number;
  dimensions?: { width: number; height: number };
  printType?: string;
  printPosition?: string;
  printSize?: string;
}

const PRINT_SIZES = [
  { value: 'small', label: 'Pequena (~10cm)' },
  { value: 'medium', label: 'Média (~20cm)' },
  { value: 'large', label: 'Grande (~30cm+)' },
];

const PRINT_POSITIONS = [
  { value: 'front', label: 'Frente' },
  { value: 'back', label: 'Verso' },
  { value: 'both', label: 'Frente + Verso' },
];

export default function QuotesPage() {
  const [inventory, setInventory] = useState<ProductOption[]>([]);
  const [quotes, setQuotes] = useState<QuoteView[]>([]);
  const [activeSection, setActiveSection] = useState<'list' | 'create'>('list');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<QuoteView | null>(null);
  const [convertingQuote, setConvertingQuote] = useState<QuoteView | null>(null);
  const [convertDeliveryDate, setConvertDeliveryDate] = useState('');

  // Restore form state from sessionStorage
  const savedForm = typeof window !== 'undefined' ? (() => {
    try {
      const raw = sessionStorage.getItem(QUOTES_FORM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })() : null;

  // Form state
  const [customerName, setCustomerName] = useState(savedForm?.customerName || '');
  const [quoteName, setQuoteName] = useState(savedForm?.quoteName || '');
  const [notes, setNotes] = useState(savedForm?.notes || '');
  const [validDays, setValidDays] = useState(savedForm?.validDays || globalConfig.quoteValidityDays);
  const [deliveryDate, setDeliveryDate] = useState(savedForm?.deliveryDate || '');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariables, setSelectedVariables] = useState<Record<string, number>>(savedForm?.selectedVariables || {});
  const [quantity, setQuantity] = useState(savedForm?.quantity || 100);
  const [logoColors, setLogoColors] = useState(savedForm?.logoColors || 1);
  const [cartItems, setCartItems] = useState<CartItem[]>(savedForm?.cartItems || []);

  // Dimensões e impressão
  const [useDimensions, setUseDimensions] = useState(savedForm?.useDimensions || false);
  const [dimWidth, setDimWidth] = useState(savedForm?.dimWidth || 30);
  const [dimHeight, setDimHeight] = useState(savedForm?.dimHeight || 40);
  const [printType, setPrintType] = useState(savedForm?.printType || '');
  const [printPosition, setPrintPosition] = useState(savedForm?.printPosition || 'front');
  const [printSize, setPrintSize] = useState(savedForm?.printSize || 'medium');

  const [configLoaded, setConfigLoaded] = useState(false);
  const [formIsDirty, setFormIsDirty] = useState(false);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (selectedQuote || convertingQuote) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [selectedQuote, convertingQuote]);

  // Track if any form field has changed from initial state
  useEffect(() => {
    const isDirty =
      !!customerName.trim() ||
      !!quoteName.trim() ||
      !!notes.trim() ||
      validDays !== globalConfig.quoteValidityDays ||
      !!deliveryDate ||
      logoColors !== 1 ||
      cartItems.length > 0 ||
      useDimensions ||
      !!printType ||
      printPosition !== 'front' ||
      printSize !== 'medium' ||
      Object.keys(selectedVariables).some(k => (selectedVariables[k] || 0) > 0) ||
      quantity !== 100;
    setFormIsDirty(isDirty);
  }, [customerName, quoteName, notes, validDays, deliveryDate, logoColors, cartItems, useDimensions, printType, printPosition, printSize, selectedVariables, quantity]);

  // Load server config so printTypes and pricing rules are up to date
  // Also reload when page becomes visible (user may have changed config in admin)
  useEffect(() => {
    function loadConfig() {
      fetch('/api/config', { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((data) => {
          if (data.config) {
            applyServerConfig(data.config);
            setConfigLoaded((prev) => !prev); // toggle to trigger useMemo
          }
        })
        .catch(() => {});
    }
    loadConfig();
    document.addEventListener('visibilitychange', loadConfig);
    window.addEventListener('focus', loadConfig);
    return () => {
      document.removeEventListener('visibilitychange', loadConfig);
      window.removeEventListener('focus', loadConfig);
    };
  }, []);

  const printTypesList = useMemo(() => [
    { value: '', label: 'Sem impressão' },
    ...globalConfig.printTypes,
  ], [configLoaded]);

  // Filtros da lista
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const currentUser = getCurrentUser();

  // Save form state to sessionStorage for persistence across navigation
  useEffect(() => {
    try {
      sessionStorage.setItem(QUOTES_FORM_KEY, JSON.stringify({
        customerName, quoteName, notes, validDays, deliveryDate, logoColors, cartItems,
        useDimensions, dimWidth, dimHeight, printType, printPosition, printSize,
        selectedVariables, quantity,
      }));
    } catch {}
  }, [customerName, quoteName, notes, validDays, deliveryDate, logoColors, cartItems, useDimensions, dimWidth, dimHeight, printType, printPosition, printSize, selectedVariables, quantity]);

  function clearFormState() {
    setCustomerName('');
    setQuoteName('');
    setNotes('');
    setValidDays(globalConfig.quoteValidityDays);
    setDeliveryDate('');
    setSelectedVariables({});
    setQuantity(100);
    setLogoColors(1);
    setCartItems([]);
    setUseDimensions(false);
    setDimWidth(30);
    setDimHeight(40);
    setPrintType('');
    setPrintPosition('front');
    setPrintSize('medium');
    try { sessionStorage.removeItem(QUOTES_FORM_KEY); } catch {}
  }

  async function safeJson(response: Response) {
    try { return await response.json(); } catch { return { error: 'Falha ao interpretar resposta.' }; }
  }

  async function loadInventory() {
    try {
      const response = await fetch('/api/inventory', { cache: 'no-store', headers: getAuthHeaders() });
      const data = await safeJson(response);
      if (response.ok) {
        setInventory(data.inventory || []);
        if ((data.inventory || []).length > 0) {
          setSelectedProductId((prev) => prev || data.inventory[0].id);
        }
      }
    } catch { setStatusMessage('Erro ao carregar estoque.'); }
  }

  async function loadQuotes() {
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const response = await fetch(`/api/quotes${params}`, { cache: 'no-store', headers: getAuthHeaders() });
      const data = await safeJson(response);
      if (response.ok) setQuotes(data.quotes || []);
    } catch { setStatusMessage('Erro ao carregar orçamentos.'); }
  }

  useEffect(() => { void loadInventory(); }, []);
  useEffect(() => { void loadQuotes(); }, [filterStatus]);

  const selectedProduct = inventory.find(p => p.id === selectedProductId);

  const selectedVariablesList = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.groups.flatMap(g => g.variables).filter(v => (selectedVariables[v.id] || 0) > 0);
  }, [selectedProduct, selectedVariables]);

  // Cálculo de preço do item atual
  const currentItemUnitCost = useMemo(() => {
    if (!selectedProduct) return 0;
    const variableCost = selectedVariablesList.reduce((sum, v) => sum + v.additionalPrice, 0);
    const dimensionCost = useDimensions ? (dimWidth * dimHeight * (globalConfig.pricePerCm2 || 0)) : 0;

    let printCost = 0;
    if (printType) {
      const rule = globalConfig.printPricingRules.find(
        r => r.printType === printType && r.size === printSize && r.position === printPosition,
      );
      if (rule) {
        printCost = rule.baseCost + Math.max(0, logoColors - 1) * (rule.costPerColor || 0);
      }
    }

    return selectedProduct.basePrice + variableCost + dimensionCost + printCost;
  }, [selectedProduct, selectedVariablesList, useDimensions, dimWidth, dimHeight, printType, printPosition, printSize, logoColors]);

  const currentItemTotalPrice = calculateSalePrice(currentItemUnitCost) * quantity;
  const cartTotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const quoteTotal = cartTotal;

  function handleAddToCart() {
    if (!selectedProduct) return;

    const selectedEntries = Object.entries(selectedVariables)
      .filter(([, qty]) => qty > 0)
      .map(([variableId, qty]) => {
        const groupId = selectedProduct.groups.find(g => g.variables.some(v => v.id === variableId))?.id || '';
        return { variableId, groupId, quantity: qty };
      });

    if (selectedEntries.length === 0) {
      setStatusMessage('Selecione pelo menos uma variável.');
      return;
    }

    const label = selectedEntries.map(e => {
      const v = selectedProduct.groups.flatMap(g => g.variables).find(v => v.id === e.variableId);
      return v?.name || e.variableId;
    }).join(', ');

    setCartItems(prev => [...prev, {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      selectedVariables: selectedEntries,
      selectedVariablesLabel: label,
      unitCost: currentItemUnitCost,
      unitPrice: calculateSalePrice(currentItemUnitCost),
      dimensions: useDimensions ? { width: dimWidth, height: dimHeight } : undefined,
      printType: printType || undefined,
      printPosition: printType ? printPosition : undefined,
      printSize: printType ? printSize : undefined,
    }]);

    setSelectedVariables({});
    setStatusMessage(`"${selectedProduct.name}" adicionado ao orçamento.`);
  }

  function handleRemoveCartItem(index: number) {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleCreateQuote() {
    if (!customerName.trim()) { setStatusMessage('Informe o nome do cliente.'); return; }
    if (cartItems.length === 0) { setStatusMessage('Adicione pelo menos um item.'); return; }

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          customerName: customerName.trim(),
          name: quoteName.trim() || `Orçamento para ${customerName}`,
          items: cartItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            selectedVariables: item.selectedVariables,
            quantity: item.quantity,
            unitCost: item.unitCost,
            unitPrice: item.unitPrice,
            dimensions: item.dimensions,
            printType: item.printType,
            printPosition: item.printPosition,
            printSize: item.printSize,
          })),
          logoColors,
          validDays,
          notes: notes.trim() || undefined,
          deliveryDate: deliveryDate || undefined,
        }),
      });

      const data = await safeJson(response);
      if (response.ok) {
        setStatusMessage('Orçamento criado com sucesso!');
        clearFormState();
        setActiveSection('list');
        await loadQuotes();
      } else {
        setStatusMessage(data.error || 'Erro ao criar orçamento.');
      }
    } catch { setStatusMessage('Erro de conexão.'); }
  }

  async function handleQuoteAction(quoteId: string, action: 'clone' | 'convert' | 'update-status', status?: string, deliveryDate?: string) {
    try {
      const body: Record<string, string> = { quoteId, action };
      if (status) body.status = status;
      if (deliveryDate) body.deliveryDate = deliveryDate;

      const response = await fetch('/api/quotes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      const data = await safeJson(response);
      if (response.ok) {
        if (action === 'convert') {
          setStatusMessage(`Orçamento convertido em pedido #${data.order?.id}!`);
        } else if (action === 'clone') {
          setStatusMessage('Orçamento clonado com sucesso!');
        } else {
          setStatusMessage('Status atualizado!');
        }
        await loadQuotes();
        setSelectedQuote(null);
      } else {
        setStatusMessage(data.error || 'Erro na operação.');
      }
    } catch { setStatusMessage('Erro de conexão.'); }
  }

  async function handleDeleteQuote(quoteId: string) {
    if (!confirm('Tem certeza que deseja remover este orçamento?')) return;
    try {
      const response = await fetch(`/api/quotes?quoteId=${quoteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await safeJson(response);
      if (response.ok) {
        setStatusMessage('Orçamento removido.');
        await loadQuotes();
      } else {
        setStatusMessage(data.error || 'Erro ao remover.');
      }
    } catch { setStatusMessage('Erro de conexão.'); }
  }

  function handleOpenConvertModal(quote: QuoteView) {
    setConvertingQuote(quote);
    setConvertDeliveryDate(quote.deliveryDate || '');
  }

  async function handleConfirmConvert() {
    if (!convertingQuote) return;
    if (!convertDeliveryDate) {
      setStatusMessage('A data de entrega é obrigatória para converter em pedido.');
      return;
    }
    await handleQuoteAction(convertingQuote.id, 'convert', undefined, convertDeliveryDate);
    setConvertingQuote(null);
    setConvertDeliveryDate('');
  }

  const filteredQuotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return quotes.filter(q => {
      if (term && !q.name.toLowerCase().includes(term) && !q.customerName.toLowerCase().includes(term) && !q.id.includes(term)) return false;
      return true;
    });
  }, [quotes, searchTerm]);

  const statusLabel = (s: string) => {
    const map: Record<string, { text: string; color: string }> = {
      draft: { text: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
      sent: { text: 'Enviado', color: 'bg-blue-100 text-blue-700' },
      approved: { text: 'Aprovado', color: 'bg-emerald-100 text-emerald-700' },
      rejected: { text: 'Rejeitado', color: 'bg-rose-100 text-rose-700' },
      converted: { text: 'Convertido', color: 'bg-purple-100 text-purple-700' },
    };
    return map[s] || { text: s, color: 'bg-slate-100 text-slate-700' };
  };

  return (
    <ProtectedPage allowedRoles={['admin', 'seller']}>
      <div>
        <PageHeader title="Orçamentos" description="Crie orçamentos profissionais para seus clientes. Calcule preços automaticamente com tabelas por volume, dimensões e impressão detalhada." />

        <div
          className="mb-6 inline-flex gap-1 rounded-xl p-1"
          style={{ background: 'var(--surface-muted)' }}
        >
          <button
            type="button"
            onClick={() => setActiveSection('list')}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeSection === 'list' ? 'var(--card-bg)' : 'transparent',
              color: activeSection === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeSection === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Meus orçamentos
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('create')}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeSection === 'create' ? 'var(--card-bg)' : 'transparent',
              color: activeSection === 'create' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeSection === 'create' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Novo orçamento
          </button>
        </div>

        {/* ============================================ */}
        {/* LISTA DE ORÇAMENTOS */}
        {/* ============================================ */}
        {activeSection === 'list' && (
          <section className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Orçamentos</p>
                <h3 className="text-2xl font-semibold text-slate-900">Seus orçamentos</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou cliente"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                  <option value="">Todos os status</option>
                  <option value="draft">Rascunho</option>
                  <option value="sent">Enviado</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Rejeitado</option>
                  <option value="converted">Convertido</option>
                </select>
              </div>
            </div>

            {filteredQuotes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum orçamento encontrado.</p>
            ) : (
              <div className="space-y-4">
                {filteredQuotes.map(quote => {
                  const sl = statusLabel(quote.status);
                  return (
                    <div key={quote.id}
                      className="cursor-pointer rounded-xl border border-slate-200 p-5 transition-all hover:border-slate-300 hover:shadow-md"
                      onClick={() => setSelectedQuote(quote)}>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{quote.name}</p>
                          <p className="text-sm text-slate-500">Cliente: {quote.customerName}</p>
                          <p className="text-sm text-slate-500">Criado por: {quote.createdByName || quote.userId}</p>
                          <p className="text-sm text-slate-500">Data: {new Date(quote.createdAt).toLocaleDateString('pt-BR')}</p>
                          <p className="text-sm font-semibold text-emerald-700">R$ {quote.totalPrice.toFixed(2)}</p>
                          {quote.validUntil && (
                            <p className="text-xs text-amber-600">
                              Válido até: {new Date(quote.validUntil).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                          {quote.deliveryDate && (
                            <p className="text-xs text-blue-600">
                              Entrega: {new Date(quote.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sl.color}`}>{sl.text}</span>

                          {quote.status === 'draft' && (
                            <>
                              <button type="button" onClick={() => handleQuoteAction(quote.id, 'update-status', 'sent')}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--brand)', color: '#fff' }}>
                                Enviar
                              </button>
                              <button type="button" onClick={() => handleQuoteAction(quote.id, 'clone')}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                                Clonar
                              </button>
                            </>
                          )}

                          {(quote.status === 'approved' || quote.status === 'sent') && (
                            <button type="button" onClick={() => handleOpenConvertModal(quote)}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: 'var(--brand)', color: '#fff' }}>
                              → Converter em Pedido
                            </button>
                          )}

                          {quote.status === 'sent' && (
                            <>
                              <button type="button" onClick={() => handleQuoteAction(quote.id, 'update-status', 'approved')}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--brand)', color: '#fff' }}>
                                Aprovar
                              </button>
                              <button type="button" onClick={() => handleQuoteAction(quote.id, 'update-status', 'rejected')}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--danger)', color: '#fff' }}>
                                Rejeitar
                              </button>
                            </>
                          )}

                          {(quote.status === 'draft' || quote.status === 'rejected') && (
                            <button type="button" onClick={() => handleDeleteQuote(quote.id)}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: 'var(--danger)', color: '#fff' }}>
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================================ */}
        {/* CRIAR ORÇAMENTO */}
        {/* ============================================ */}
        {activeSection === 'create' && (
          <div className="space-y-6">
            {/* Dados do cliente */}
            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Dados do orçamento</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-slate-700">
                  <span>Nome do cliente *</span>
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                    placeholder="Ex: Empresa ABC"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" />
                </label>
                <label className="space-y-2 text-slate-700">
                  <span>Nome do orçamento</span>
                  <input value={quoteName} onChange={e => setQuoteName(e.target.value)}
                    placeholder="Ex: Sacolas TNT 500un"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" />
                </label>
                <label className="space-y-2 text-slate-700">
                  <span>Validade (dias)</span>
                  <input type="number" min={1} value={validDays} onChange={e => setValidDays(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" />
                </label>
                <label className="space-y-2 text-slate-700">
                  <span>Data de entrega</span>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" />
                </label>
                <label className="space-y-2 text-slate-700">
                  <span>Cores da logo</span>
                  <input type="number" min={0} max={10} value={logoColors} onChange={e => setLogoColors(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" />
                </label>
                <label className="space-y-2 text-slate-700 md:col-span-2">
                  <span>Observações</span>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Notas internas sobre este orçamento..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" />
                </label>
              </div>
            </section>

            {/* Seleção de produto */}
            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Adicionar item</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-slate-700">
                  <span>Produto</span>
                  <select value={selectedProductId} onChange={e => { setSelectedProductId(e.target.value); setSelectedVariables({}); }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    {inventory.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-slate-700">
                  <span>Quantidade</span>
                  <input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" />
                </label>
                <div className="flex items-end">
                  <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    Unitário: R$ {calculateSalePrice(currentItemUnitCost).toFixed(2)} | Total: R$ {currentItemTotalPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Variáveis do produto */}
              {selectedProduct && (
                <div className="mt-4 space-y-4">
                  {selectedProduct.groups.map(group => (
                    <div key={group.id} className="rounded-2xl border border-slate-200 p-4">
                      <p className="font-semibold text-slate-900">{group.name}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {group.variables.map(variable => (
                          <div key={variable.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <input type="radio" name={`group-${group.id}`}
                              checked={(selectedVariables[variable.id] || 0) > 0}
                              onChange={() => setSelectedVariables(prev => {
                                const next: Record<string, number> = {};
                                for (const v of group.variables) next[v.id] = 0;
                                for (const [k, v] of Object.entries(prev)) {
                                  if (!(group.variables.some(gv => gv.id === k))) next[k] = v;
                                }
                                next[variable.id] = 1;
                                return next;
                              })}
                              aria-label={`Selecionar ${variable.name}`} />
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{variable.name}</p>
                              <p className="text-xs text-slate-600">+R$ {variable.additionalPrice.toFixed(2)} | Estoque: {variable.stock}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dimensões */}
              <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                <label className="flex items-center gap-2 text-slate-700">
                  <input type="checkbox" checked={useDimensions} onChange={e => setUseDimensions(e.target.checked)} />
                  <span className="font-medium">Calcular por dimensão (largura × altura)</span>
                </label>
                {useDimensions && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm text-slate-600">
                      <span>Largura (cm)</span>
                      <input type="number" min={1} value={dimWidth} onChange={e => setDimWidth(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                    </label>
                    <label className="space-y-1 text-sm text-slate-600">
                      <span>Altura (cm)</span>
                      <input type="number" min={1} value={dimHeight} onChange={e => setDimHeight(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                    </label>
                  </div>
                )}
              </div>

              {/* Impressão */}
              <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 font-medium text-slate-900">Impressão da logo</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-sm text-slate-600">
                    <span>Tipo</span>
                    <select value={printType} onChange={e => setPrintType(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
                      {printTypesList.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  {printType && (
                    <>
                      <label className="space-y-1 text-sm text-slate-600">
                        <span>Tamanho</span>
                        <select value={printSize} onChange={e => setPrintSize(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
                          {PRINT_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm text-slate-600">
                        <span>Posição</span>
                        <select value={printPosition} onChange={e => setPrintPosition(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
                          {PRINT_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </label>
                    </>
                  )}
                </div>
              </div>

              <button type="button" onClick={handleAddToCart}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: 'var(--brand)', color: '#fff' }}>
                Adicionar ao orçamento
              </button>
            </section>

            {/* Carrinho do orçamento */}
            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Itens do orçamento</h3>
                <p className="text-sm text-slate-500">{cartItems.length} item(ns)</p>
              </div>

              {cartItems.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Nenhum item adicionado.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {cartItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{item.productName}</p>
                        <p className="text-sm text-slate-600">Qtd: {item.quantity} | Variáveis: {item.selectedVariablesLabel}</p>
                        {item.dimensions && <p className="text-xs text-slate-500">Dimensão: {item.dimensions.width}×{item.dimensions.height}cm</p>}
                        {item.printType && <p className="text-xs text-slate-500">Impressão: {item.printType} ({item.printSize}, {item.printPosition})</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold text-emerald-700">R$ {(item.unitPrice * item.quantity).toFixed(2)}</p>
                        <button type="button" onClick={() => handleRemoveCartItem(i)}
                          className="rounded-lg px-3 py-1 text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--danger)', color: '#fff' }}>
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-lg font-bold text-slate-900">
                  <span>Total do orçamento</span>
                  <span className="text-emerald-700">R$ {quoteTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button type="button" onClick={handleCreateQuote}
                  className="inline-flex h-12 items-center justify-center rounded-lg px-8 text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: 'var(--brand)', color: '#fff' }}>
                  Salvar Orçamento
                </button>
                {formIsDirty && (
                  <button
                    type="button"
                    onClick={clearFormState}
                    className="inline-flex h-12 items-center justify-center rounded-lg px-6 text-sm font-medium transition hover:opacity-80"
                    style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
                  >
                    Cancelar tudo
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ============================================ */}
        {/* MODAL DE DETALHES DO ORÇAMENTO */}
        {/* ============================================ */}
        {selectedQuote ? createPortal(
          <div
            className="modal-overlay"
            onClick={() => setSelectedQuote(null)}
          >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '1rem' }}>
            <div
              className="modal-content rounded-xl bg-white p-8 shadow-2xl"
              style={{ maxHeight: '90vh', width: '100%', maxWidth: '42rem', overflowY: 'auto', overscrollBehavior: 'contain' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Detalhes do orçamento</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">{selectedQuote.name}</h3>
                </div>
                <button type="button" onClick={() => setSelectedQuote(null)}
                  className="rounded-lg p-2 transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Cliente</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedQuote.customerName}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                  <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${statusLabel(selectedQuote.status).color}`}>
                    {statusLabel(selectedQuote.status).text}
                  </span>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Data</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{new Date(selectedQuote.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Validade</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedQuote.validUntil ? new Date(selectedQuote.validUntil).toLocaleDateString('pt-BR') : 'Sem validade'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Entrega</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedQuote.deliveryDate ? new Date(selectedQuote.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não definida'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Custo</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">R$ {selectedQuote.totalCost.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase text-emerald-600">Preço final</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">R$ {selectedQuote.totalPrice.toFixed(2)}</p>
                </div>
              </div>

              {selectedQuote.notes && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">Observações</p>
                  <p className="mt-1 text-sm text-amber-700">{selectedQuote.notes}</p>
                </div>
              )}

              {/* Itens */}
              <div className="mt-6">
                <h4 className="font-bold text-slate-900">Itens do orçamento</h4>
                <div className="mt-3 space-y-3">
                  {selectedQuote.items.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{item.productName || `Produto ${item.productId}`}</p>
                          <p className="text-xs text-slate-500">{item.quantity}x — R$ {(item.unitPrice || 0).toFixed(2)} un.</p>
                        </div>
                        <p className="font-bold text-slate-900">R$ {((item.unitCost || 0) * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="mt-6 flex flex-wrap gap-3">
                {selectedQuote.status === 'draft' && (
                  <>
                    <button type="button" onClick={() => handleQuoteAction(selectedQuote.id, 'update-status', 'sent')}
                      className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}>
                      Marcar como Enviado
                    </button>
                    <button type="button" onClick={() => handleQuoteAction(selectedQuote.id, 'clone')}
                      className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                      Clonar
                    </button>
                  </>
                )}
                {selectedQuote.status === 'sent' && (
                  <>
                    <button type="button" onClick={() => handleQuoteAction(selectedQuote.id, 'update-status', 'approved')}
                      className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}>
                      Aprovar
                    </button>
                    <button type="button" onClick={() => handleQuoteAction(selectedQuote.id, 'update-status', 'rejected')}
                      className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--danger)', color: '#fff' }}>
                      Rejeitar
                    </button>
                  </>
                )}
                {(selectedQuote.status === 'approved' || selectedQuote.status === 'sent') && (
                  <button type="button" onClick={() => { setSelectedQuote(null); handleOpenConvertModal(selectedQuote); }}
                    className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: 'var(--brand)', color: '#fff' }}>
                    Converter em Pedido
                  </button>
                )}
                <button type="button" onClick={() => setSelectedQuote(null)}
                  className="rounded-lg px-5 py-2 text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
          </div>
        , document.body) : null}

        {/* ============================================ */}
        {/* MODAL DE CONFIRMAÇÃO DE CONVERSÃO */}
        {/* ============================================ */}
        {convertingQuote ? createPortal(
          <div
            className="modal-overlay"
            onClick={() => { setConvertingQuote(null); setConvertDeliveryDate(''); }}
          >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '1rem' }}>
            <div
              className="modal-content rounded-xl bg-white p-8 shadow-2xl"
              style={{ maxHeight: '90vh', width: '100%', maxWidth: '28rem', overflowY: 'auto', overscrollBehavior: 'contain' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Converter em Pedido</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{convertingQuote.name}</h3>
                </div>
                <button type="button" onClick={() => { setConvertingQuote(null); setConvertDeliveryDate(''); }}
                  className="rounded-lg p-2 transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>

              <p className="mt-4 text-sm text-slate-600">
                Para converter este orçamento em pedido, confirme ou altere a data de entrega.
              </p>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Cliente</p>
                <p className="mt-1 font-semibold text-slate-900">{convertingQuote.customerName}</p>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">R$ {convertingQuote.totalPrice.toFixed(2)}</p>
              </div>

              <label className="mt-4 block space-y-2 text-slate-700">
                <span>Data de entrega *</span>
                <input
                  type="date"
                  value={convertDeliveryDate}
                  onChange={e => setConvertDeliveryDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                />
                {!convertingQuote.deliveryDate && (
                  <p className="text-xs text-amber-600">Este orçamento não tinha data de entrega definida.</p>
                )}
              </label>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => { setConvertingQuote(null); setConvertDeliveryDate(''); }}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button type="button" onClick={() => void handleConfirmConvert()}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--brand)', color: '#fff' }}>
                  Confirmar Conversão
                </button>
              </div>
            </div>
          </div>
          </div>
        , document.body) : null}

        {statusMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 px-6 py-3 text-sm text-white shadow-lg">
            {statusMessage}
            <button type="button" onClick={() => setStatusMessage('')} className="ml-3 text-white/60 hover:text-white">✕</button>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}

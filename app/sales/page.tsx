'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateLogoCost, calculateSalePrice, globalConfig, applyServerConfig } from '../../config/global';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders, getCurrentUser } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import { Order, Quote } from '../../types';
import ProductPreview from '../components/product-preview';
import type { PreviewConfig } from '../components/product-preview';

const SALES_FORM_KEY = 'elitium-sales-form';

interface VariableOption {
  id: string;
  name: string;
  additionalPrice: number;
  stock: number;
  groupId: string;
  unitOfMeasure?: string;
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

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  selectedVariables: { groupId: string; variableId: string; quantity: number }[];
  selectedVariablesLabel: string;
  unitCost: number;
  unitPrice: number;
  profitMargin: number;
  minMargin: number;
  previewConfig: PreviewConfig;
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

export default function SalesPage() {
  const [inventory, setInventory] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  // Restore form state from sessionStorage
  const savedForm = typeof window !== 'undefined' ? (() => {
    try {
      const raw = sessionStorage.getItem(SALES_FORM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })() : null;

  const [selectedVariables, setSelectedVariables] = useState<Record<string, number>>(savedForm?.selectedVariables || {});
  const [quantity, setQuantity] = useState(savedForm?.quantity || 1);
  const [orderName, setOrderName] = useState(savedForm?.orderName || '');
  const [deliveryDate, setDeliveryDate] = useState(savedForm?.deliveryDate || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');
  const [logoDataUrl, setLogoDataUrl] = useState<string>(''); // Data URL da logo para canvas
  const [logoAnalysisResult, setLogoAnalysisResult] = useState<{
    totalColors: number;
    colors: { hex: string; rgb: { r: number; g: number; b: number }; name?: string; pixelFraction: number }[];
    productColor: string | null;
    productColorRgb: { r: number; g: number; b: number } | null;
    complexity: string;
    description: string;
    source?: string;
  } | null>(null);
  const [logoAnalyzing, setLogoAnalyzing] = useState(false);
  const [logoAnalysisError, setLogoAnalysisError] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>(
    (savedForm?.cartItems || []).map((item: CartItem) => ({
      ...item,
      profitMargin: item.profitMargin ?? 20,
      minMargin: item.minMargin ?? item.profitMargin ?? 20,
    }))
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [undoOrderData, setUndoOrderData] = useState<{ message: string; items: OrderView[]; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Auto-dismiss status messages after 4 seconds
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const [orders, setOrders] = useState<OrderView[]>([]);
  const [orderStatusUpdates, setOrderStatusUpdates] = useState<Record<string, Order['status']>>({});
  const [orderSearch, setOrderSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt-desc' | 'createdAt-asc' | 'deliveryDate-asc' | 'deliveryDate-desc' | 'price-desc' | 'price-asc' | 'urgency'>('createdAt-desc');
  const [activeSection, setActiveSection] = useState<'search' | 'create'>('search');
  const [selectedOrder, setSelectedOrder] = useState<OrderView | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState(false);
  const [editOrderName, setEditOrderName] = useState('');
  const [editItems, setEditItems] = useState<{ productId: string; quantity: number; unitCost: number; unitPrice: number; profitMargin: number; minMargin: number; selectedVariables: { groupId: string; variableId: string; quantity: number }[] }[]>([]);
  const [editLogoColors, setEditLogoColors] = useState(0);
  const [editDeliveryDate, setEditDeliveryDate] = useState('');

  // Urgência de entrega
  type Urgency = { label: string; color: string; bgColor: string; days: number };
  function getDeliveryUrgency(deliveryDate?: string, delivered?: boolean): Urgency | null {
    if (!deliveryDate || delivered) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const delivery = new Date(deliveryDate + 'T12:00:00');
    const diffMs = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `Atrasado ${Math.abs(diffDays)}d`, color: 'text-rose-800', bgColor: 'bg-rose-100 border-rose-300', days: diffDays };
    if (diffDays === 0) return { label: 'Hoje', color: 'text-orange-800', bgColor: 'bg-orange-100 border-orange-300', days: 0 };
    if (diffDays === 1) return { label: 'Amanhã', color: 'text-amber-800', bgColor: 'bg-amber-100 border-amber-300', days: 1 };
    if (diffDays <= 3) return { label: `${diffDays} dias`, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', days: diffDays };
    if (diffDays <= 7) return { label: `${diffDays} dias`, color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', days: diffDays };
    return { label: `${diffDays} dias`, color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200', days: diffDays };
  }

  async function handleMarkDelivered(orderId: string, delivered: boolean) {
    const response = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ orderId, delivered }),
    });
    const data = await safeJson(response);
    if (response.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivered, deliveredAt: data.order?.deliveredAt } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, delivered, deliveredAt: data.order?.deliveredAt } : null);
      setStatusMessage(delivered ? 'Pedido marcado como entregue!' : 'Entrega desfeita.');
    } else {
      setStatusMessage(data.error || 'Erro ao atualizar entrega.');
    }
  }

  async function handleUpdateDeliveryDate(orderId: string, newDate: string) {
    const response = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ orderId, deliveryDate: newDate }),
    });
    const data = await safeJson(response);
    if (response.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deliveryDate: newDate } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, deliveryDate: newDate } : null);
      setStatusMessage('Data de entrega atualizada.');
    } else {
      setStatusMessage(data.error || 'Erro ao atualizar data.');
    }
  }

  // Seletor de orçamento
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showQuoteSelector, setShowQuoteSelector] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState('');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedOrder) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [selectedOrder]);

  // Dimensões e impressão
  const [useDimensions, setUseDimensions] = useState(savedForm?.useDimensions || false);
  const [dimWidth, setDimWidth] = useState(savedForm?.dimWidth || 30);
  const [dimHeight, setDimHeight] = useState(savedForm?.dimHeight || 40);
  const [printType, setPrintType] = useState(savedForm?.printType || '');
  const [printPosition, setPrintPosition] = useState(savedForm?.printPosition || 'front');
  const [printSize, setPrintSize] = useState(savedForm?.printSize || 'medium');

  const [configLoaded, setConfigLoaded] = useState(false);
  const [formIsDirty, setFormIsDirty] = useState(false);

  // Track if any form field has changed from initial state
  useEffect(() => {
    const isDirty =
      !!orderName.trim() ||
      !!deliveryDate ||
      cartItems.length > 0 ||
      useDimensions ||
      !!printType ||
      printPosition !== 'front' ||
      printSize !== 'medium' ||
      Object.keys(selectedVariables).some(k => (selectedVariables[k] || 0) > 0) ||
      quantity !== 1 ||
      !!logoFile;
    setFormIsDirty(isDirty);
  }, [orderName, deliveryDate, cartItems, useDimensions, printType, printPosition, printSize, selectedVariables, quantity, logoFile]);

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

  const currentUser = getCurrentUser();
  const { getPageLayout } = useLayout();

  // Save form state to sessionStorage for persistence across navigation
  useEffect(() => {
    try {
      sessionStorage.setItem(SALES_FORM_KEY, JSON.stringify({
        orderName, deliveryDate, cartItems,
        useDimensions, dimWidth, dimHeight,
        printType, printPosition, printSize,
        selectedVariables, quantity,
      }));
    } catch {}
  }, [orderName, deliveryDate, cartItems, useDimensions, dimWidth, dimHeight, printType, printPosition, printSize, selectedVariables, quantity]);

  function clearFormState() {
    setOrderName('');
    setDeliveryDate('');
    setCartItems([]);
    setUseDimensions(false);
    setDimWidth(30);
    setDimHeight(40);
    setPrintType('');
    setPrintPosition('front');
    setPrintSize('medium');
    setSelectedVariables({});
    setQuantity(1);
    setLogoFile(null);
    try { sessionStorage.removeItem(SALES_FORM_KEY); } catch {}
  }

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

  // Converte File para data URL (para uso no canvas)
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl('');
      setLogoDataUrl('');
      setLogoAnalysisResult(null);
      setLogoAnalysisError('');
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

    // Converte para data URL (necessário para canvas cross-origin)
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(logoFile);

    // Análise de cores da logo
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
  const logoColors = logoAnalysisResult?.totalColors ?? 0;
  const logoCost = calculateLogoCost(logoColors);

  // Encontra variáveis selecionadas com detalhes
  const selectedVariablesList = useMemo(() => {
    if (!selectedProduct) return [];
    const allVariables = selectedProduct.groups.flatMap((group) => group.variables);
    return allVariables.filter((variable) => (selectedVariables[variable.id] || 0) > 0);
  }, [selectedProduct, selectedVariables]);

  // Encontra cor selecionada (variável de grupo "Cor" ou similar)
  const selectedColorHex = (() => {
    if (!selectedProduct) return undefined;
    for (const group of selectedProduct.groups) {
      if (group.name.toLowerCase().includes('cor')) {
        for (const v of group.variables) {
          if ((selectedVariables[v.id] || 0) > 0) {
            return getColorHexFromName(v.name);
          }
        }
      }
    }
    return undefined;
  })();

  // Nome da cor selecionada
  const selectedColorName = useMemo(() => {
    if (!selectedProduct) return undefined;
    for (const group of selectedProduct.groups) {
      if (group.name.toLowerCase().includes('cor')) {
        for (const v of group.variables) {
          if ((selectedVariables[v.id] || 0) > 0) return v.name;
        }
      }
    }
    return undefined;
  }, [selectedProduct, selectedVariables]);

  // Encontra nome do material selecionado
  const selectedMaterialName = useMemo(() => {
    if (!selectedProduct) return undefined;
    for (const group of selectedProduct.groups) {
      if (group.name.toLowerCase().includes('material')) {
        for (const v of group.variables) {
          if ((selectedVariables[v.id] || 0) > 0) return v.name;
        }
      }
    }
    return undefined;
  }, [selectedProduct, selectedVariables]);

  // previewConfig defined below (after currentItemUnitCost)

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      const matchText = !term || order.id.toLowerCase().includes(term) || order.name.toLowerCase().includes(term);
      if (!matchText) return false;
      const createdAt = new Date(order.createdAt);
      if (fromDate && createdAt < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && createdAt > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });

    const sorted = [...filtered];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (sortBy) {
      case 'createdAt-desc':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'createdAt-asc':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'deliveryDate-asc':
        sorted.sort((a, b) => {
          const aDate = a.deliveryDate ? new Date(a.deliveryDate + 'T12:00:00').getTime() : Infinity;
          const bDate = b.deliveryDate ? new Date(b.deliveryDate + 'T12:00:00').getTime() : Infinity;
          return aDate - bDate;
        });
        break;
      case 'deliveryDate-desc':
        sorted.sort((a, b) => {
          const aDate = a.deliveryDate ? new Date(a.deliveryDate + 'T12:00:00').getTime() : 0;
          const bDate = b.deliveryDate ? new Date(b.deliveryDate + 'T12:00:00').getTime() : 0;
          return bDate - aDate;
        });
        break;
      case 'price-desc':
        sorted.sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0));
        break;
      case 'price-asc':
        sorted.sort((a, b) => (a.totalPrice || 0) - (b.totalPrice || 0));
        break;
      case 'urgency':
        sorted.sort((a, b) => {
          // Entregas pendentes primeiro, ordenadas por urgência
          const getScore = (o: OrderView) => {
            if (o.delivered) return 1000;
            if (!o.deliveryDate) return 999;
            const delivery = new Date(o.deliveryDate + 'T12:00:00');
            const diff = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diff;
          };
          return getScore(a) - getScore(b);
        });
        break;
    }

    return sorted;
  }, [orders, orderSearch, fromDate, toDate, sortBy]);

  const groupQuantityWarnings = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.groups
      .map((group) => {
        const selectedCount = group.variables.filter((v) => (selectedVariables[v.id] || 0) > 0).length;
        return {
          groupId: group.id,
          groupName: group.name,
          selectedCount,
          ok: selectedCount === 1,
        };
      })
      .filter((item) => !item.ok);
  }, [selectedProduct, selectedVariables]);

  const currentItemUnitCost = selectedProduct
    ? selectedProduct.basePrice + selectedVariablesList.reduce((sum, variable) => sum + variable.additionalPrice, 0)
      + (useDimensions ? dimWidth * dimHeight * (globalConfig.pricePerCm2 || 0) : 0)
      + (() => {
          if (!printType) return 0;
          const rule = globalConfig.printPricingRules.find(
            r => r.printType === printType && r.size === printSize && r.position === printPosition,
          );
          if (rule) return rule.baseCost + Math.max(0, logoColors - 1) * (rule.costPerColor || 0);
          return 0;
        })()
    : 0;
  const currentItemTotalCost = currentItemUnitCost * quantity;
  const cartItemsCost = cartItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const cartItemsPrice = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const logoCostValue = logoCost;
  const salePrice = cartItemsPrice + (logoCostValue > 0 ? calculateSalePrice(logoCostValue) : 0);

  // Configuração da prévia atual (após cálculos de preço)
  const selectedVariableNames = useMemo(() => {
    return selectedVariablesList.map(v => v.name);
  }, [selectedVariablesList]);

  const previewConfig = useMemo(() => ({
    productImageUrl: selectedProduct?.imageUrl || '',
    productName: selectedProduct?.name || 'Produto',
    logoDataUrl: logoDataUrl || null,
    selectedColorHex,
    selectedColorName,
    selectedMaterialName,
    selectedVariables: selectedVariableNames,
    printPosition: printType ? printPosition : undefined,
    printSize: printType ? printSize : undefined,
    quantity,
    unitPrice: selectedProduct ? calculateSalePrice(currentItemUnitCost, selectedProduct.profitMargin) : 0,
  }), [selectedProduct, logoDataUrl, selectedColorHex, selectedColorName, selectedMaterialName, selectedVariableNames, printType, printPosition, printSize, quantity, currentItemUnitCost]);

  async function loadQuotes() {
    try {
      const response = await fetch('/api/quotes', {
        cache: 'no-store',
        headers: getAuthHeaders(),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        setStatusMessage(data.error || 'Falha ao carregar orçamentos.');
        return;
      }
      setQuotes(data.quotes || []);
    } catch {
      setStatusMessage('Conexão instável ao carregar orçamentos.');
    }
  }

  function handleSelectQuote(quote: Quote) {
    setOrderName(quote.name || '');
    setDeliveryDate(quote.deliveryDate || '');
    setCartItems(quote.items.map((qi) => ({
      productId: qi.productId,
      productName: qi.productName,
      quantity: qi.quantity,
      selectedVariables: qi.selectedVariables,
      selectedVariablesLabel: qi.selectedVariables.map((sv) => sv.variableId).join(', '),
      unitCost: qi.unitCost,
      unitPrice: qi.unitPrice,
      profitMargin: qi.unitCost > 0 ? Math.round(((qi.unitPrice - qi.unitCost) / qi.unitCost) * 100 * 10) / 10 : 20,
      minMargin: qi.unitCost > 0 ? Math.round(((qi.unitPrice - qi.unitCost) / qi.unitCost) * 100 * 10) / 10 : 20,
      previewConfig: {
        productImageUrl: '',
        productName: qi.productName,
        logoDataUrl: null,
        selectedColorHex: undefined,
        selectedColorName: undefined,
        selectedMaterialName: undefined,
        selectedVariables: [],
        quantity: qi.quantity,
        unitPrice: qi.unitPrice,
      },
      dimensions: qi.dimensions,
      printType: qi.printType,
      printPosition: qi.printPosition,
      printSize: qi.printSize,
    })));
    setShowQuoteSelector(false);
    setStatusMessage(`Orçamento "${quote.name}" carregado com sucesso.`);
  }

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
      setStatusMessage('Selecione pelo menos uma variável.');
      return;
    }

    if (groupQuantityWarnings.length > 0) {
      setStatusMessage('Selecione uma opção de cada grupo.');
      return;
    }

    const selectedVariablesLabel = selectedEntries
      .map((entry) => {
        const variable = selectedProduct.groups.flatMap((group) => group.variables).find((item) => item.id === entry.variableId);
        return variable?.name || entry.variableId;
      })
      .join(', ');

    // Salva a config da prévia para renderizar no carrinho
    setCartItems((previous) => [
      ...previous,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity,
        selectedVariables: selectedEntries,
        selectedVariablesLabel,
        unitCost: currentItemUnitCost,
        unitPrice: calculateSalePrice(currentItemUnitCost, selectedProduct.profitMargin),
        profitMargin: selectedProduct.profitMargin ?? 20,
        minMargin: selectedProduct.profitMargin ?? 20,
        previewConfig: { ...previewConfig },
        dimensions: useDimensions ? { width: dimWidth, height: dimHeight } : undefined,
        printType: printType || undefined,
        printPosition: printType ? printPosition : undefined,
        printSize: printType ? printSize : undefined,
      },
    ]);
    setSelectedVariables({});
    setQuantity(1);
    setStatusMessage(`Item "${selectedProduct.name}" adicionado ao carrinho com prévia.`);
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

    if (!deliveryDate) {
      setStatusMessage('Informe a data de entrega.');
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
          dimensions: item.dimensions,
          printType: item.printType,
          printPosition: item.printPosition,
          printSize: item.printSize,
        })),
        logoColors,
        deliveryDate,
      }),
    });

    const result = await safeJson(response);
    if (response.ok) {
      setStatusMessage('Pedido finalizado com sucesso. Nota fiscal gerada automaticamente.');
      setSelectedVariables({});
      setLogoFile(null);
      setQuantity(1);
      setOrderName('');
      setDeliveryDate('');
      setCartItems([]);
      setUseDimensions(false);
      setDimWidth(30);
      setDimHeight(40);
      setPrintType('');
      setPrintPosition('front');
      setPrintSize('medium');
      try { sessionStorage.removeItem(SALES_FORM_KEY); } catch {}
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

  function handleStartEditOrder() {
    if (!selectedOrder) return;
    setEditingOrder(true);
    setEditOrderName(selectedOrder.name);
    setEditItems(selectedOrder?.items.map(item => {
      const derivedMargin = item.unitCost > 0 ? Math.round(((item.unitPrice - item.unitCost) / item.unitCost) * 100 * 10) / 10 : 20;
      return {
        ...item,
        profitMargin: derivedMargin,
        minMargin: derivedMargin,
      };
    }));
    setEditLogoColors(selectedOrder?.logoCost > 0 ? Math.round(selectedOrder?.logoCost / (globalConfig.logoPricePerColor || 10)) : 0);
    setEditDeliveryDate(selectedOrder?.deliveryDate || '');
  }

  function handleCancelEditOrder() {
    setEditingOrder(false);
    setEditOrderName('');
    setEditItems([]);
    setEditLogoColors(0);
    setEditDeliveryDate('');
  }

  function handleEditItemQuantity(index: number, newQuantity: number) {
    setEditItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(1, newQuantity) } : item));
  }

  function handleRemoveEditItem(index: number) {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSaveEditOrder() {
    if (!selectedOrder) return;
    if (!editOrderName.trim()) {
      setStatusMessage('Informe um nome para o pedido.');
      return;
    }
    if (editItems.length === 0) {
      setStatusMessage('O pedido deve ter pelo menos um item.');
      return;
    }

    const totalCost = editItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    const itemsPrice = editItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const logoCost = calculateLogoCost(editLogoColors);
    const totalPrice = itemsPrice + (logoCost > 0 ? calculateSalePrice(logoCost) : 0);

    const response = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        orderId: selectedOrder?.id,
        editData: {
          name: editOrderName,
          items: editItems,
          totalCost,
          totalPrice,
          logoCost,
        },
        deliveryDate: editDeliveryDate || selectedOrder?.deliveryDate,
      }),
    });

    const data = await safeJson(response);
    if (response.ok) {
      const updatedOrder = data.order || { ...selectedOrder, name: editOrderName, items: editItems, totalCost, totalPrice, logoCost, deliveryDate: editDeliveryDate || selectedOrder?.deliveryDate };
      setOrders(prev => prev.map(o => o.id === selectedOrder?.id ? { ...o, ...updatedOrder } : o));
      setSelectedOrder(prev => prev ? { ...prev, ...updatedOrder } : null);
      setEditingOrder(false);
      setStatusMessage('Pedido atualizado com sucesso.');
    } else {
      setStatusMessage(data.error || 'Erro ao atualizar pedido.');
    }
  }

  async function handleUndoDeleteOrders(deletedItems: OrderView[]) {
    if (undoOrderData?.timer) clearTimeout(undoOrderData.timer);
    setUndoOrderData(null);
    let restored = 0;
    for (const order of deletedItems) {
      try {
        const resp = await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ action: 'restore', restoreData: order }),
        });
        if (resp.ok) restored++;
      } catch { /* skip */ }
    }
    setStatusMessage(`${restored} pedido(s) restaurado(s)!`);
    await loadOrders();
  }

  function showOrderUndoToast(message: string, items: OrderView[]) {
    if (undoOrderData?.timer) clearTimeout(undoOrderData.timer);
    const timer = setTimeout(() => setUndoOrderData(null), 10000);
    setUndoOrderData({ message, items, timer });
  }

  async function handleDeleteCancelledOrder(orderId: string) {
    const confirmed = window.confirm('Tem certeza que deseja remover este pedido cancelado?');
    if (!confirmed) return;

    const orderToDelete = orders.find(o => o.id === orderId);
    const response = await fetch(`/api/orders?orderId=${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await safeJson(response);
    if (response.ok) {
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      if (orderToDelete) showOrderUndoToast(data.message || 'Pedido removido.', [orderToDelete]);
      else setStatusMessage(data.message || 'Pedido removido com sucesso.');
    } else {
      setStatusMessage(data.error || 'Erro ao remover pedido.');
    }
  }

  async function handleBulkDeleteOrders() {
    if (selectedOrderIds.size === 0) return;

    const idsToDelete = [...selectedOrderIds].filter(id => {
      const order = orders.find(o => o.id === id);
      return order?.status === 'cancelled';
    });

    if (idsToDelete.length === 0) {
      setStatusMessage('Nenhum pedido cancelado selecionado. Apenas pedidos cancelados podem ser removidos.');
      return;
    }

    if (!confirm(`Tem certeza que deseja remover ${idsToDelete.length} pedido(s) cancelado(s)?`)) return;

    const deletedItems: OrderView[] = [];
    let removed = 0;
    let errors = 0;
    for (const id of idsToDelete) {
      const orderToDelete = orders.find(o => o.id === id);
      try {
        const response = await fetch(`/api/orders?orderId=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (response.ok) { removed++; if (orderToDelete) deletedItems.push(orderToDelete); }
        else errors++;
      } catch { errors++; }
    }

    setSelectedOrderIds(new Set());
    if (removed > 0) {
      setOrders(prev => prev.filter(o => !idsToDelete.includes(o.id)));
      showOrderUndoToast(`${removed} pedido(s) removido(s).`, deletedItems);
    } else if (errors > 0) {
      setStatusMessage(`${errors} erro(s) ao remover.`);
    }
  }

  function toggleOrderSelection(id: string) {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOrders() {
    setSelectedOrderIds(prev => {
      if (prev.size === filteredOrders.length) return new Set();
      return new Set(filteredOrders.map(o => o.id));
    });
  }

  const PAGE_PATH = '/sales';
  const DEFAULT_SECTIONS: SectionConfig[] = [
    { id: 'search-section', visible: true, order: 0, colSpan: 2 },
    { id: 'create-section', visible: true, order: 1, colSpan: 2 },
  ];
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  return (
    <ProtectedPage allowedRoles={['admin', 'seller']}>
      <div>
        <PageHeader title="Pedidos" description="Fluxo de venda com seleção de produto, variáveis, cálculo automático de preço e prévia visual real do produto." />
        <LayoutToolbar pagePath={PAGE_PATH} />
        <div
          className="mb-6 inline-flex gap-1 rounded-xl p-1"
          style={{ background: 'var(--surface-muted)' }}
        >
          <button
            type="button"
            onClick={() => setActiveSection('search')}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeSection === 'search' ? 'var(--card-bg)' : 'transparent',
              color: activeSection === 'search' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeSection === 'search' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Buscar pedidos
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
            Criar pedido
          </button>
        </div>

        {activeSection === 'search' && sections[0] ? (
        <DraggableSection pagePath={PAGE_PATH} section={sections[0]} index={0} totalSections={sections.length}>
        <section className="mb-8 rounded-2xl bg-white p-8 shadow-sm">
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
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2"
              />
              <label className="text-sm text-slate-600">
                Data inicial
                <input
                  type="date"
                  value={fromDate}
                  aria-label="Data inicial dos pedidos"
                  title="Data inicial dos pedidos"
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2"
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
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Ordenar por:</span>
              {[
                { value: 'createdAt-desc', label: 'Mais recentes' },
                { value: 'createdAt-asc', label: 'Mais antigos' },
                { value: 'urgency', label: 'Urgência' },
                { value: 'deliveryDate-asc', label: 'Entrega ↑' },
                { value: 'deliveryDate-desc', label: 'Entrega ↓' },
                { value: 'price-desc', label: 'Maior valor' },
                { value: 'price-asc', label: 'Menor valor' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSortBy(opt.value as typeof sortBy)}
                  className="rounded-lg px-3 py-1 text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    background: sortBy === opt.value ? 'var(--brand)' : 'var(--surface-muted)',
                    color: sortBy === opt.value ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum pedido registrado ainda.</p>
          ) : (
            <div className="space-y-4">
              {/* Barra de seleção múltipla */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                    onChange={toggleAllOrders}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Selecionar todos</span>
                </label>
                {selectedOrderIds.size > 0 && (
                  <>
                    <span className="text-xs text-slate-500">{selectedOrderIds.size} selecionado(s)</span>
                    <button
                      type="button"
                      onClick={() => void handleBulkDeleteOrders()}
                      className="ml-auto rounded-lg px-4 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--danger)', color: '#fff' }}
                    >
                      Remover selecionados (cancelados)
                    </button>
                  </>
                )}
              </div>

              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="cursor-pointer rounded-xl border border-slate-200 p-5 transition-all hover:border-slate-300 hover:shadow-md"
                  onClick={() => setSelectedOrder(order)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOrder(order); }}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-slate-300 cursor-pointer"
                      />
                      <div>
                      <p className="font-semibold text-slate-900">{order.name || `Pedido ${order.id}`}</p>
                      <p className="text-sm text-slate-500">ID: {order.id}</p>
                      <p className="text-sm text-slate-500">Criado por: {order.createdByName || order.userId}</p>
                      <p className="text-sm text-slate-500">Data: {new Date(order.createdAt).toLocaleDateString()}</p>
                      {order.deliveryDate && (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-blue-600">Entrega: {new Date(order.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          {(() => {
                            const urgency = getDeliveryUrgency(order.deliveryDate, order.delivered);
                            if (!urgency) return null;
                            return <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${urgency.bgColor} ${urgency.color}`}>{urgency.label}</span>;
                          })()}
                        </div>
                      )}
                      {order.delivered && (
                        <p className="text-sm text-emerald-600 font-medium">✓ Entregue{order.deliveredAt ? ` em ${new Date(order.deliveredAt).toLocaleDateString('pt-BR')}` : ''}</p>
                      )}
                      <p className="text-sm text-slate-500">Total: R$ {(order.totalPrice || 0).toFixed(2)}</p>
                      {order.items && order.items.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {order.items.map((item, idx) => (
                            <p key={idx} className="text-xs text-slate-400">
                              • {item.quantity}x — R$ {(item.unitPrice || 0).toFixed(2)} / unidade de medida
                            </p>
                          ))}
                        </div>
                      ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>Status: {order.status}</span>
                      {order.status === 'completed' && !order.delivered && (
                        <button
                          type="button"
                          onClick={() => void handleMarkDelivered(order.id, true)}
                          className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--brand)', color: '#fff' }}
                        >
                          ✓ Entregue
                        </button>
                      )}
                      {order.delivered && (
                        <button
                          type="button"
                          onClick={() => void handleMarkDelivered(order.id, false)}
                          className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                        >
                          Desfazer entrega
                        </button>
                      )}
                      {currentUser?.role === 'admin' ? (
                        <>
                          <select
                            value={orderStatusUpdates[order.id] || order.status}
                            onChange={(event) => handleStatusChange(order.id, event.target.value as Order['status'])}
                            aria-label={`Status do pedido ${order.name || order.id}`}
                            title="Status do pedido"
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2"
                          >
                            <option value="pending">Pendente</option>
                            <option value="completed">Concluído</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                          {order.status === 'cancelled' ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteCancelledOrder(order.id)}
                              className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                              style={{ background: 'var(--danger)', color: '#fff' }}
                            >
                              Remover cancelado
                            </button>
                          ) : null}
                        </>
                      ) : order.status !== 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'cancelled')}
                          className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--warning, #f59e0b)', color: '#fff' }}
                        >
                          Cancelar pedido
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleDeleteCancelledOrder(order.id)}
                          className="rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--danger)', color: '#fff' }}
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
        </DraggableSection>
        ) : null}

        {activeSection === 'create' && sections[1] ? (
        <DraggableSection pagePath={PAGE_PATH} section={sections[1]} index={1} totalSections={sections.length}>
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-slate-700 md:col-span-2">
              <span>Nome do pedido</span>
              <input
                value={orderName}
                onChange={(event) => setOrderName(event.target.value)}
                placeholder="Ex: Sacola - 10 materiais"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-slate-700">
              <span>Data de entrega *</span>
              <input
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => { setShowQuoteSelector(true); void loadQuotes(); }}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--brand-muted)', color: 'var(--brand)', borderColor: 'var(--brand-muted)' }}
              >
                Selecionar orçamento
              </button>
            </div>
            {/* Seletor de orçamento */}
            {showQuoteSelector ? (
              <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="font-semibold text-emerald-900">Selecionar orçamento</p>
                  <button
                    type="button"
                    onClick={() => setShowQuoteSelector(false)}
                    className="rounded-lg px-3 py-1 text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    Fechar
                  </button>
                </div>
                <input
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Buscar orçamento por nome..."
                  className="mb-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
                />
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {quotes
                    .filter((q) => q.status === 'approved' || q.status === 'sent')
                    .filter((q) => !quoteSearch.trim() || q.name.toLowerCase().includes(quoteSearch.toLowerCase()) || q.customerName.toLowerCase().includes(quoteSearch.toLowerCase()))
                    .length === 0 ? (
                    <p className="text-sm text-emerald-700">Nenhum orçamento disponível.</p>
                  ) : (
                    quotes
                      .filter((q) => q.status === 'approved' || q.status === 'sent')
                      .filter((q) => !quoteSearch.trim() || q.name.toLowerCase().includes(quoteSearch.toLowerCase()) || q.customerName.toLowerCase().includes(quoteSearch.toLowerCase()))
                      .map((quote) => (
                        <div
                          key={quote.id}
                          className="cursor-pointer rounded-xl border border-emerald-200 bg-white p-3 transition hover:border-emerald-400"
                          onClick={() => handleSelectQuote(quote)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectQuote(quote); }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{quote.name}</p>
                              <p className="text-xs text-slate-500">Cliente: {quote.customerName}</p>
                              <p className="text-xs text-slate-500">Itens: {quote.items.length} | R$ {(quote.totalPrice || 0).toFixed(2)}</p>
                              {quote.deliveryDate && (
                                <p className="text-xs text-blue-600">Entrega: {new Date(quote.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                              )}
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              quote.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {quote.status === 'approved' ? 'Aprovado' : 'Enviado'}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            ) : null}
            <label className="space-y-2 text-slate-700">
              <span>Produto base</span>
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                aria-label="Produto base"
                title="Seleção de produto base"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                {inventory.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-slate-700">
              <span>Quantidade (unidades)</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
          </div>

          {selectedProduct ? (
            <div className="space-y-6">
              {selectedProduct.groups.map((group) => (
                <div key={group.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{group.name}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {group.variables.map((variable) => {
                      const isSelected = (selectedVariables[variable.id] || 0) > 0;
                      return (
                      <div
                        key={variable.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-pointer transition-all"
                        style={{
                          borderColor: isSelected ? 'var(--brand)' : undefined,
                          background: isSelected ? 'var(--brand-muted)' : undefined,
                        }}
                        onClick={() => {
                          setSelectedVariables((state) => {
                            const next: Record<string, number> = {};
                            for (const v of group.variables) {
                              next[v.id] = 0;
                            }
                            for (const [k, v] of Object.entries(state)) {
                              if (!(group.variables.some(gv => gv.id === k))) {
                                next[k] = v;
                              }
                            }
                            next[variable.id] = 1;
                            return next;
                          });
                        }}
                      >
                        <input
                          type="radio"
                          name={`group-${group.id}`}
                          aria-label={`Selecionar ${variable.name}`}
                          checked={isSelected}
                          readOnly
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{variable.name}</p>
                          <p className="text-sm text-slate-600">+R$ {variable.additionalPrice.toFixed(2)} / unidade</p>
                          <p className="text-xs text-slate-500">Estoque: {variable.stock} un.</p>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {groupQuantityWarnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {groupQuantityWarnings.map((warning) => (
                <p key={warning.groupId}>
                  Selecione uma opção de {warning.groupName.toLowerCase()}.
                </p>
              ))}
            </div>
          ) : null}

          {/* CALCULAR POR DIMENSÃO */}
          <div className="rounded-xl border border-slate-200 p-4">
            <label className="flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={useDimensions} onChange={e => setUseDimensions(e.target.checked)} />
              <span className="font-medium">Calcular por dimensão (largura x altura)</span>
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

          {/* IMPRESSÃO DA LOGO */}
          <div className="rounded-xl border border-slate-200 p-4">
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

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Upload de logo</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff"
              aria-label="Upload de logo"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setLogoFile(file);
              }}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-3"
            />
            {logoAnalyzing ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--brand)]">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analisando cores da logo…
              </div>
            ) : logoAnalysisError ? (
              <p className="mt-3 text-xs text-red-600">{logoAnalysisError}</p>
            ) : logoAnalysisResult ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold text-emerald-800">
                    {logoColors} {logoColors === 1 ? 'cor detectada' : 'cores detectadas'}
                  </p>
                  <p className="text-xs text-emerald-700">{logoAnalysisResult.description}</p>
                </div>
                {logoAnalysisResult.colors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {logoAnalysisResult.colors.map((color, i) => (
                      <div key={i} className="group relative">
                        <span
                          className="inline-block h-6 w-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                          {color.hex}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Envie uma imagem para análise automática de cores. Cada cor detectada custa R$ {globalConfig.logoPricePerColor}.
              </p>
            )}
          </div>

          {/* CARRINHO COM PRÉVIAS */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Carrinho do pedido</p>
              <p className="text-sm text-slate-600">{cartItems.length} item(ns)</p>
            </div>
            {cartItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nenhum item adicionado.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {cartItems.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    {/* Prévia visual do item */}
                    <div className="h-24 w-24 flex-shrink-0">
                      <ProductPreview config={item.previewConfig} compact className="h-24 w-24" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{item.productName}</p>
                      <p className="text-sm text-slate-600">Qtd: {item.quantity}</p>
                      <p className="text-sm text-slate-600 truncate">Variáveis: {item.selectedVariablesLabel}</p>
                      {item.dimensions && <p className="text-xs text-slate-500">Dimensão: {item.dimensions.width}x{item.dimensions.height}cm</p>}
                      {item.printType && <p className="text-xs text-slate-500">Impressão: {item.printType} ({item.printSize}, {item.printPosition})</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-500">Margem</span>
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const newMargin = Math.max(item.minMargin, item.profitMargin - 0.5);
                              setCartItems((prev) => prev.map((ci, ciIdx) => {
                                if (ciIdx !== index) return ci;
                                return { ...ci, profitMargin: newMargin, unitPrice: calculateSalePrice(ci.unitCost, newMargin) };
                              }));
                            }}
                            className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                          >−</button>
                          <input
                            type="number"
                            min={item.minMargin}
                            step={0.5}
                            value={item.profitMargin}
                            onChange={(e) => {
                              const newMargin = Math.max(item.minMargin, Number(e.target.value));
                              setCartItems((prev) => prev.map((ci, ciIdx) => {
                                if (ciIdx !== index) return ci;
                                return { ...ci, profitMargin: newMargin, unitPrice: calculateSalePrice(ci.unitCost, newMargin) };
                              }));
                            }}
                            className="w-14 border-x border-slate-200 px-1 py-1 text-center text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none"
                            style={{ MozAppearance: 'textfield' }}
                            title={`Margem mínima: ${item.minMargin}%`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newMargin = item.profitMargin + 0.5;
                              setCartItems((prev) => prev.map((ci, ciIdx) => {
                                if (ciIdx !== index) return ci;
                                return { ...ci, profitMargin: newMargin, unitPrice: calculateSalePrice(ci.unitCost, newMargin) };
                              }));
                            }}
                            className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                          >+</button>
                        </div>
                        <span className="text-[10px] text-slate-400">mín {item.minMargin}%</span>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[11px] font-semibold text-emerald-600">R$ {item.unitPrice.toFixed(2)}/un</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-800">Subtotal: R$ {(item.unitPrice * item.quantity).toFixed(2)}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(index)}
                        className="mt-2 rounded-lg px-3 py-1 text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: 'var(--danger)', color: '#fff' }}
                      >
                        Remover item
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddItemToCart}
            className="inline-flex h-12 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            Adicionar item ao carrinho
          </button>

          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
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

            {/* PRÉVIA VISUAL EM TEMPO REAL — Card de catálogo */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">Prévia do produto</p>
              <ProductPreview
                config={previewConfig}
                className="w-full"
              />
              {!selectedColorHex && logoAnalysisResult?.productColor ? (
                <p className="mt-2 text-[10px] text-amber-600">
                  Selecione uma variável de cor para aplicar na imagem do produto
                </p>
              ) : null}
              <p className="mt-2 text-[10px] text-slate-400">
                A prévia mostra exatamente como o produto ficará com as opções selecionadas.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="inline-flex h-12 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-80" style={{ background: 'var(--brand)', color: '#fff' }} type="submit">
              Finalizar Pedido
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

        </form>
        </DraggableSection>
        ) : null}

      {/* ========================================== */}
      {/* MODAL DE DETALHES DO PEDIDO */}
      {/* ========================================== */}
      {selectedOrder ? createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedOrder(null); setEditingOrder(false); } }}
        >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '1rem' }}>
          <div
            className="modal-content rounded-xl bg-white p-8 shadow-2xl"
            style={{ maxHeight: '90vh', width: '100%', maxWidth: '42rem', overflowY: 'auto', overscrollBehavior: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {editingOrder ? 'Editar pedido' : 'Detalhes do pedido'}
                </p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">
                  {editingOrder ? editOrderName : (selectedOrder?.name || `Pedido ${selectedOrder?.id ?? ''}`)}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle visualizar/editar */}
                {!editingOrder && selectedOrder?.status !== 'cancelled' ? (
                  <button
                    type="button"
                    onClick={handleStartEditOrder}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    Editar pedido
                  </button>
                ) : null}
                {/* Botão Entregue */}
                {!editingOrder && selectedOrder?.status === 'completed' && !selectedOrder?.delivered && (
                  <button
                    type="button"
                    onClick={() => void handleMarkDelivered(selectedOrder!.id, true)}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    ✓ Entregue
                  </button>
                )}
                {!editingOrder && selectedOrder?.delivered && (
                  <button
                    type="button"
                    onClick={() => void handleMarkDelivered(selectedOrder!.id, false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    Desfazer entrega
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedOrder(null); setEditingOrder(false); }}
                  className="rounded-lg p-2 transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Fechar"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {editingOrder ? (
              /* ==================== MODO EDIÇÃO ==================== */
              <div className="mt-6 space-y-6">
                {/* Nome do pedido editável */}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2 text-slate-700">
                    <span className="text-sm font-semibold">Nome do pedido</span>
                    <input
                      value={editOrderName}
                      onChange={(e) => setEditOrderName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>
                  <label className="block space-y-2 text-slate-700">
                    <span className="text-sm font-semibold">Data de entrega</span>
                    <input
                      type="date"
                      value={editDeliveryDate}
                      onChange={(e) => setEditDeliveryDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>
                </div>

                {/* Itens editáveis */}
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Itens do pedido</h4>
                  <div className="mt-3 space-y-3">
                    {editItems.map((item, idx) => {
                      const product = inventory.find((p) => p.id === item.productId);
                      const minMargin = item.minMargin ?? product?.profitMargin ?? 20;
                      return (
                        <div key={idx} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{product?.name || `Produto ${item.productId}`}</p>
                              <p className="text-xs text-slate-500">ID: {item.productId}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-sm text-slate-600">
                                <span>Qtd:</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => handleEditItemQuantity(idx, Number(e.target.value))}
                                  className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveEditItem(idx)}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--danger)', color: '#fff' }}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3 flex-wrap">
                            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const newMargin = Math.max(minMargin, item.profitMargin - 0.5);
                                  setEditItems((prev) => prev.map((ci, ciIdx) => {
                                    if (ciIdx !== idx) return ci;
                                    return { ...ci, profitMargin: newMargin, unitPrice: calculateSalePrice(ci.unitCost, newMargin) };
                                  }));
                                }}
                                className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                              >−</button>
                              <input
                                type="number"
                                min={minMargin}
                                step={0.5}
                                value={item.profitMargin}
                                onChange={(e) => {
                                  const newMargin = Math.max(minMargin, Number(e.target.value));
                                  setEditItems((prev) => prev.map((ci, ciIdx) => {
                                    if (ciIdx !== idx) return ci;
                                    return { ...ci, profitMargin: newMargin, unitPrice: calculateSalePrice(ci.unitCost, newMargin) };
                                  }));
                                }}
                                className="w-14 border-x border-slate-200 px-1 py-1 text-center text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none"
                                style={{ MozAppearance: 'textfield' }}
                                title={`Margem mínima: ${minMargin}%`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newMargin = item.profitMargin + 0.5;
                                  setEditItems((prev) => prev.map((ci, ciIdx) => {
                                    if (ciIdx !== idx) return ci;
                                    return { ...ci, profitMargin: newMargin, unitPrice: calculateSalePrice(ci.unitCost, newMargin) };
                                  }));
                                }}
                                className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                              >+</button>
                            </div>
                            <span className="text-[10px] text-slate-400">mín {minMargin}%</span>
                            <span className="text-slate-500 text-xs">Custo un.: R$ {(item.unitCost || 0).toFixed(2)}</span>
                            <span className="font-semibold text-slate-900 text-xs">Subtotal: R$ {((item.unitPrice || item.unitCost || 0) * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cores da logo editável */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">Cores da logo</p>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      value={editLogoColors}
                      onChange={(e) => setEditLogoColors(Number(e.target.value))}
                      className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-slate-500">cores × R$ {globalConfig.logoPricePerColor} = R$ {calculateLogoCost(editLogoColors).toFixed(2)}</span>
                  </div>
                </div>

                {/* Preview de custo em tempo real */}
                {(() => {
                  const editTotalCost = editItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
                  const editItemsPrice = editItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                  const editLogoCost = calculateLogoCost(editLogoColors);
                  const editTotalPrice = editItemsPrice + (editLogoCost > 0 ? calculateSalePrice(editLogoCost) : 0);
                  return (
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Preview de custo</h4>
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Custo dos itens</span>
                          <span className="text-slate-900">R$ {editTotalCost.toFixed(2)}</span>
                        </div>
                        {editLogoCost > 0 ? (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Custo da logo</span>
                            <span className="text-slate-900">R$ {editLogoCost.toFixed(2)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Custo total</span>
                          <span className="font-semibold text-slate-900">R$ {(editTotalCost + editLogoCost).toFixed(2)}</span>
                        </div>
                        <div className="border-t border-slate-200 pt-2">
                          <div className="flex justify-between">
                            <span className="text-sm font-bold text-slate-900">Preço de venda</span>
                            <span className="text-lg font-bold text-emerald-700">R$ {editTotalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Botões salvar/cancelar */}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancelEditOrder}
                    className="rounded-lg px-6 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveEditOrder()}
                    className="rounded-lg px-6 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    Salvar alterações
                  </button>
                </div>
              </div>
            ) : (
              /* ==================== MODO VISUALIZAÇÃO ==================== */
              <>
                {/* Info geral */}
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">ID</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{selectedOrder?.id}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Data</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{new Date(selectedOrder?.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Entrega</p>
                    {editingOrder ? (
                      <input
                        type="date"
                        value={selectedOrder?.deliveryDate || ''}
                        onChange={(e) => setSelectedOrder(prev => prev ? { ...prev, deliveryDate: e.target.value } : null)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedOrder?.deliveryDate ? new Date(selectedOrder.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</p>
                        {(() => {
                          const urgency = getDeliveryUrgency(selectedOrder?.deliveryDate, selectedOrder?.delivered);
                          if (!urgency) return null;
                          return <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${urgency.bgColor} ${urgency.color}`}>{urgency.label}</span>;
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Situação</p>
                    {selectedOrder?.delivered ? (
                      <p className="mt-1 text-sm font-bold text-emerald-700">✓ Entregue{selectedOrder?.deliveredAt ? ` em ${new Date(selectedOrder.deliveredAt).toLocaleDateString('pt-BR')}` : ''}</p>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-amber-600">Pendente entrega</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Criado por</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedOrder?.createdByName || selectedOrder?.userId}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                        selectedOrder?.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedOrder?.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedOrder?.status === 'completed' ? 'Concluído' : selectedOrder?.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                    </span>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Custo total</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">R$ {(selectedOrder?.totalCost || 0).toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Preço de venda</p>
                    <p className="mt-1 text-lg font-bold text-emerald-700">R$ {(selectedOrder?.totalPrice || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Custo da logo */}
                {selectedOrder?.logoCost > 0 ? (
                  <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-4">
                    <p className="text-sm font-semibold text-purple-800">
                      Custo da personalização: R$ {selectedOrder?.logoCost.toFixed(2)}
                    </p>
                  </div>
                ) : null}

                {/* Itens do pedido */}
                <div className="mt-6">
                  <h4 className="text-lg font-bold text-slate-900">Itens do pedido</h4>
                  <div className="mt-3 space-y-3">
                    {selectedOrder?.items.map((item, idx) => {
                      const product = inventory.find((p) => p.id === item.productId);
                      const allVariables = product?.groups.flatMap((g) => g.variables) || [];
                      const selectedVars = item.selectedVariables.map((sv) => {
                        const v = allVariables.find((av) => av.id === sv.variableId);
                        return {
                          name: v?.name || sv.variableId,
                          quantity: sv.quantity,
                          additionalPrice: v?.additionalPrice || 0,
                          unitOfMeasure: v?.unitOfMeasure || 'un',
                        };
                      });

                      return (
                        <div key={idx} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{product?.name || `Produto ${item.productId}`}</p>
                              <p className="text-xs text-slate-500">ID: {item.productId}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">{item.quantity}x</p>
                              <p className="text-xs text-slate-500">R$ {(item.unitPrice || 0).toFixed(2)} un.</p>
                            </div>
                          </div>

                          {/* Variáveis selecionadas */}
                          {selectedVars.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedVars.map((v, vi) => (
                                <span
                                  key={vi}
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                                >
                                  {v.name}
                                  {v.quantity > 1 ? ` ×${v.quantity}` : ''}
                                  {v.additionalPrice > 0 ? ` (+R$ ${v.additionalPrice.toFixed(2)}/un)` : ''}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {/* Subtotal do item */}
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-xs text-slate-500">Custo unitário</span>
                            <span className="text-sm text-slate-700">R$ {(item.unitCost || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">Subtotal</span>
                            <span className="text-sm font-bold text-slate-900">R$ {((item.unitCost || 0) * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo financeiro */}
                <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Resumo financeiro</h4>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Custo dos itens</span>
                      <span className="text-slate-900">R$ {((selectedOrder?.totalCost || 0) - (selectedOrder?.logoCost || 0)).toFixed(2)}</span>
                    </div>
                    {selectedOrder?.logoCost > 0 ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Custo da logo</span>
                        <span className="text-slate-900">R$ {selectedOrder?.logoCost.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Custo total</span>
                      <span className="font-semibold text-slate-900">R$ {(selectedOrder?.totalCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-slate-900">Preço de venda</span>
                        <span className="text-lg font-bold text-emerald-700">R$ {(selectedOrder?.totalPrice || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-slate-500">Margem</span>
                        <span className="text-xs font-semibold text-emerald-600">
                          R$ {((selectedOrder?.totalPrice || 0) - (selectedOrder?.totalCost || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botão fechar */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="rounded-lg px-6 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        </div>
      , document.body) : null}

        {/* Toast de undo para remoção de pedidos */}
        {undoOrderData && createPortal(
          <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl bg-slate-900 px-6 py-3 text-sm text-white shadow-lg">
            <span>{undoOrderData.message}</span>
            <button
              type="button"
              onClick={() => void handleUndoDeleteOrders(undoOrderData.items)}
              className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/30"
            >
              ↩ Desfazer
            </button>
            <button type="button" onClick={() => { if (undoOrderData.timer) clearTimeout(undoOrderData.timer); setUndoOrderData(null); }} className="ml-1 text-white/60 hover:text-white">✕</button>
          </div>
        , document.body)}

        {/* Toast de status — barra fixa embaixo */}
        {statusMessage && createPortal(
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-center px-6 py-3"
            style={{
              background: statusMessage.includes('Erro') || statusMessage.includes('erro') ? 'var(--danger-bg, #fef2f2)' : 'var(--success-bg, #f0fdf4)',
              borderTop: `2px solid ${statusMessage.includes('Erro') || statusMessage.includes('erro') ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)'}`,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <span className="text-sm font-semibold" style={{ color: statusMessage.includes('Erro') || statusMessage.includes('erro') ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)' }}>
              {statusMessage.includes('Erro') || statusMessage.includes('erro') ? '✕' : '✓'} {statusMessage}
            </span>
            <button type="button" onClick={() => setStatusMessage('')} className="ml-4 text-xs font-medium opacity-60 hover:opacity-100" style={{ color: 'var(--text-secondary)' }}>✕</button>
          </div>
        , document.body)}

      </div>
    </ProtectedPage>
  );
}

// ==========================================
// UTILITÁRIO: Converter nome de cor para hex
// ==========================================
function getColorHexFromName(name: string): string | undefined {
  const colorMap: Record<string, string> = {
    vermelho: '#dc2626', red: '#dc2626',
    azul: '#2563eb', blue: '#2563eb',
    verde: '#16a34a', green: '#16a34a',
    amarelo: '#eab308', yellow: '#eab308',
    preto: '#1e293b', black: '#1e293b',
    branco: '#f8fafc', white: '#f8fafc',
    rosa: '#ec4899', pink: '#ec4899',
    roxo: '#9333ea', purple: '#9333ea',
    laranja: '#ea580c', orange: '#ea580c',
    cinza: '#64748b', gray: '#64748b', grey: '#64748b',
    marrom: '#92400e', brown: '#92400e',
    dourado: '#ca8a04', gold: '#ca8a04',
    prata: '#94a3b8', silver: '#94a3b8',
    bege: '#d4a574', beige: '#d4a574',
    vinho: '#7f1d1d', bordô: '#7f1d1d',
    ciano: '#06b6d4', cyan: '#06b6d4',
    magenta: '#d946ef',
    nude: '#d4a574',
    natural: '#d4a574',
  };

  const lower = name.toLowerCase().trim();
  // Busca exata
  if (colorMap[lower]) return colorMap[lower];
  // Busca parcial
  for (const [key, hex] of Object.entries(colorMap)) {
    if (lower.includes(key)) return hex;
  }
  return undefined;
}

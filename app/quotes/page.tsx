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

// LogoE base64 for PDF header
const LOGO_E_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODQ3IiBoZWlnaHQ9IjM2OSIgdmlld0JveD0iMCAwIDg0NyAzNjkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0yNDQuOTc0IDIyNy43MzlMMjkwIDI1Ny45NDdWMTA1LjMxNkwyNDQuOTc0IDEzNi4zMzdWMjI3LjczOVoiIGZpbGw9IiM0ODM3N0MiLz4KPHBhdGggZD0iTTAgOTAuMzMwMUwxNDMuNTM1IDBMMjkwIDkwLjMzMDFDMjc1LjM1NCAxMDAuMDQzIDI0NC45NzQgMTIyLjQ4NyAyNDQuOTc0IDEyMi40ODdDMjQ0Ljk3NCAxMjQuODE4IDE3Ny43MSA4Mi41NTk4IDE0My41MzUgNjEuMTkxNEw0OS43OTggMTIyLjM4M1YxODAuNjZMMCAyMTIuNzEzVjkwLjMzMDFaIiBmaWxsPSIjRjZGOUVBIi8+CjxwYXRoIGQ9Ik0yMTYuNzY4IDE1NC40MzVMMTY0LjA0IDEyMi4zODNMMCAyMjguNzM5VjI4NC4xMDNMMTQzLjUzNSAzNjguNjA1TDI5MCAyNzMuOTA0TDI0NC45NzQgMjQ0LjU5MkwxNDMuNTM1IDMwNS45NTdMNTQuMTkxOSAyNTYuNDIxTDIxNi43NjggMTU0LjQzNVoiIGZpbGw9IiNGNkY5RUEiLz4KPHBhdGggZD0iTTM5NC40NjYgMjIxVjExMy40MzhINDQwLjg3NlYxMjEuNjI4SDQwNi4yOTZWMTYwLjIxMkg0MzMuOTZWMTY5LjMxMkg0MDYuMjk2VjIxMi44MUg0NDAuODc2VjIyMUgzOTQuNDY2Wk00NjUuNzczIDIyMVYxMTMuNDM4SDQ3Ny4wNTdWMjEyLjgxSDUwNy4wODdWMjIxSDQ2NS43NzNaTTUyOC45MDQgMjIxVjExMy40MzhINTQwLjM3VjIyMUg1MjguOTA0Wk01ODAuODYxIDIyMVYxMjEuNjI4SDU2Mi44NDNWMTEzLjQzOEg2MTAuNzA5VjEyMS42MjhINTkyLjMyN1YyMjFINTgwLjg2MVpNNjMzLjMwNSAyMjFWMTEzLjQzOEg2NDQuNzcxVjIyMUg2MzMuMzA1Wk03MDIuOTE2IDIyMy4xODRDNjk5LjE1NSAyMjMuMTg0IDY5NS42MzYgMjIyLjg4MSA2OTIuMzYgMjIyLjI3NEM2ODkuMDg0IDIyMS42NjcgNjg2LjE3MiAyMjAuNTE1IDY4My42MjQgMjE4LjgxNkM2ODEuMTk4IDIxNy4xMTcgNjc5LjI1NiAyMTQuNjMgNjc3LjggMjExLjM1NEM2NzYuNDY2IDIwNy45NTcgNjc1Ljc5OCAyMDMuNDY3IDY3NS43OTggMTk3Ljg4NlYxMTMuNDM4SDY4Ny4yNjRWMjAwLjI1MkM2ODcuMjY0IDIwNC42MiA2ODcuOTkyIDIwNy44OTYgNjg5LjQ0OCAyMTAuMDhDNjkwLjkwNCAyMTIuMjY0IDY5Mi43ODUgMjEzLjc4MSA2OTUuMDkgMjE0LjYzQzY5Ny41MTcgMjE1LjM1OCA3MDAuMTI2IDIxNS43MjIgNzAyLjkxNiAyMTUuNzIyQzcwNS41ODYgMjE1LjcyMiA3MDguMTM0IDIxNS4zNTggNzEwLjU2IDIxNC42M0M3MTIuOTg3IDIxMy43ODEgNzE0LjkyOCAyMTIuMjY0IDcxNi4zODQgMjEwLjA4QzcxNy44NCAyMDcuODk2IDcxOC41NjggMjA0LjYyIDcxOC41NjggMjAwLjI1MlYxMTMuNDM4SDcyOS44NTJWMTk3Ljg4NkM3MjkuODUyIDIwMy40NjcgNzI5LjEyNCAyMDcuOTU3IDcyNy42NjggMjExLjM1NEM3MjYuMzM0IDIxNC42MyA3MjQuNDUzIDIxNy4xMTcgNzIyLjAyNiAyMTguODE2QzcxOS42IDIyMC41MTUgNzE2LjY4OCAyMjEuNjY3IDcxMy4yOSAyMjIuMjc0QzcxMC4wMTQgMjIyLjg4MSA3MDYuNTU2IDIyMy4xODQgNzAyLjkxNiAyMjMuMTg0Wk03NjAuOTkgMjIxVjExMy40MzhINzc0LjQ1OEw3OTcuNzU0IDIwMC45OEw4MjEuNTk2IDExMy40MzhIODM0LjUxOFYyMjFIODI0LjMyNlYxMzQuMDA0TDgwMS45NCAyMjFINzkzLjc1TDc3MS4zNjQgMTM0LjAwNFYyMjFINzYwLjk5WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTM5NC43MjUgMjg5VjI0NC42NzVINDEzLjg1VjI0OC4wNUgzOTkuNlYyNjMuOTVINDExVjI2Ny43SDM5OS42VjI4NS42MjVINDEzLjg1VjI4OUgzOTQuNzI1Wk00MjAuMzYgMjg5VjI0NC42NzVINDM0LjMxQzQzNi44MSAyNDQuNjc1IDQzOC44MzUgMjQ1LjI3NSA0NDAuMzg1IDI0Ni40NzVDNDQxLjkzNSAyNDcuNjI1IDQ0Mi43MSAyNDkuNDc1IDQ0Mi43MSAyNTIuMDI1VjI1OS4yMjVDNDQyLjcxIDI2MS43NzUgNDQxLjkzNSAyNjMuNzUgNDQwLjM4NSAyNjUuMTVDNDM4Ljg4NSAyNjYuNTUgNDM2LjgzNSAyNjcuMyA0MzQuMjM1IDI2Ny40VjI2Ny4zMjVDNDM1LjgzNSAyNjcuNDI1IDQzNy4wMzUgMjY4IDQzNy44MzUgMjY5LjA1QzQzOC42MzUgMjcwLjA1IDQzOS4zMzUgMjcxLjYyNSA0MzkuOTM1IDI3My43NzVMNDQ0LjUxIDI4OUg0MzkuMjZMNDM1LjIxIDI3NC4wNzVDNDM0LjgxIDI3Mi42NzUgNDM0LjI4NSAyNzEuNDI1IDQzMy42MzUgMjcwLjMyNUM0MzMuMDM1IDI2OS4xNzUgNDMyLjAzNSAyNjguNiA0MzAuNjM1IDI2OC42SDQyNS4yMzVWMjg5SDQyMC4zNlpNNDI1LjIzNSAyNjUuMjI1SDQzMS44MzVDNDM0LjEzNSAyNjUuMjI1IDQzNS43MzUgMjY0LjcgNDM2LjYzNSAyNjMuNjVDNDM3LjU4NSAyNjIuNTUgNDM4LjA2IDI2MC45NSA0MzguMDYgMjU4Ljg1VjI1Mi44NUM0MzguMDYgMjUxIDQzNy42MSAyNDkuNjUgNDM2LjcxIDI0OC44QzQzNS44NiAyNDcuOSA0MzQuNTM1IDI0Ny40NSA0MzIuNzM1IDI0Ny40NUg0MjUuMjM1VjI2NS4yMjVaTTQ1MS40MTQgMjg5VjI0NC42NzVINDY1LjEzOUM0NjcuNjg5IDI0NC42NzUgNDY5LjczOSAyNDUuMjc1IDQ3MS4yODkgMjQ2LjQ3NUM0NzIuODM5IDI0Ny42MjUgNDczLjYxNCAyNDkuNDc1IDQ3My42MTQgMjUyLjAyNVYyNjAuMkM0NzMuNjE0IDI2MS45IDQ3My4zNjQgMjYzLjUgNDcyLjg2NCAyNjVDNDcyLjM2NCAyNjYuNDUgNDcxLjQzOSAyNjcuNjI1IDQ3MC4wODkgMjY4LjUyNUM0NjguNzM5IDI2OS40MjUgNDY2Ljc4OSAyNjkuODc1IDQ2NC4yMzkgMjY5Ljg3NUg0NTYuMjg5VjI4OUg0NTEuNDE0Wk00NTYuMjg5IDI2Ny4xSDQ2Mi44MTRDNDY0LjgxNCAyNjcuMSA0NjYuMzE0IDI2Ni41IDQ2Ny4zMTQgMjY1LjNDNDY4LjM2NCAyNjQuMDUgNDY4Ljg4OSAyNjIuMTUgNDY4Ljg4OSAyNTkuNlYyNTMuODI1QzQ2OC44ODkgMjUxLjYyNSA0NjguNDE0IDI1MC4wMjUgNDY3LjQ2NCAyNDkuMDI1QzQ2Ni41MTQgMjQ3Ljk3NSA0NjUuMzY0IDI0Ny40NSA0NjQuMDE0IDI0Ny40NUg0NTYuMjg5VjI2Ny4xWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==';

function generateQuotePDF(quote: QuoteView) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const createdStr = new Date(quote.createdAt).toLocaleDateString('pt-BR');
  const validStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('pt-BR') : 'Sem validade';
  const deliveryStr = quote.deliveryDate ? new Date(quote.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não definida';

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado',
    rejected: 'Rejeitado', converted: 'Convertido',
  };

  const itemsHtml = quote.items.map((item, i) => {
    const varSummary = item.selectedVariables?.length
      ? item.selectedVariables.map(sv => (sv as Record<string, unknown>).variableName || sv.variableId).join(', ')
      : '—';
    return `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td>${item.productName || 'Produto'}</td>
      <td>${varSummary}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">R$ ${item.unitPrice.toFixed(2)}</td>
      <td style="text-align:right">R$ ${(item.unitPrice * item.quantity).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orçamento ${quote.name} — Elitium ERP</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc; color: #0f172a; padding: 2rem;
      -webkit-font-smoothing: antialiased;
    }
    .report-container {
      max-width: 900px; margin: 0 auto; background: #fff;
      border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .report-header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: #fff; padding: 2rem 2.5rem;
      display: flex; justify-content: space-between; align-items: center;
    }
    .report-header-left { flex: 1; }
    .report-header-right { flex-shrink: 0; margin-left: 2rem; display: flex; align-items: center; }
    .report-header-right img { height: 64px; width: auto; opacity: 0.9; }
    .report-header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
    .report-header p { opacity: 0.85; font-size: 0.85rem; }
    .report-header .meta { margin-top: 0.75rem; display: flex; gap: 2rem; font-size: 0.75rem; opacity: 0.7; }
    .report-body { padding: 2rem 2.5rem; }
    .info-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 1rem; margin-bottom: 2rem;
    }
    .info-card {
      background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 1rem 1.25rem;
    }
    .info-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 600; }
    .info-value { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-top: 0.25rem; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .data-table th {
      text-align: left; padding: 0.75rem 1rem; font-size: 0.7rem;
      text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;
      border-bottom: 2px solid #e2e8f0; font-weight: 600;
    }
    .data-table td { padding: 0.6rem 1rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; }
    .row-even { background: #fff; }
    .row-odd { background: #f8fafc; }
    .totals { margin-top: 1.5rem; text-align: right; }
    .totals-row { display: flex; justify-content: flex-end; gap: 3rem; padding: 0.4rem 0; font-size: 0.9rem; }
    .totals-row .label { color: #64748b; min-width: 120px; text-align: right; }
    .totals-row .value { font-weight: 600; color: #0f172a; min-width: 120px; text-align: right; }
    .totals-total { border-top: 2px solid #334155; margin-top: 0.5rem; padding-top: 0.5rem; font-size: 1.1rem; font-weight: 700; }
    .notes { margin-top: 1.5rem; padding: 1rem 1.25rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; }
    .notes-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #92400e; font-weight: 600; margin-bottom: 0.5rem; }
    .notes-text { font-size: 0.85rem; color: #78350f; }
    .report-footer {
      padding: 1.25rem 2.5rem; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.75rem; color: #94a3b8;
    }
    .report-footer .brand { font-weight: 700; color: #334155; }
    @media print {
      body { padding: 0; background: #fff; }
      .report-container { box-shadow: none; border-radius: 0; }
      .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .row-even, .row-odd { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <div class="report-header-left">
        <h1>${quote.name}</h1>
        <p>Orçamento para ${quote.customerName}</p>
        <div class="meta">
          <span>📅 ${dateStr}</span>
          <span>🕐 ${timeStr}</span>
          <span>📋 ${statusLabels[quote.status] || quote.status}</span>
        </div>
      </div>
      <div class="report-header-right">
        <img src="${LOGO_E_BASE64}" alt="Elitium" />
      </div>
    </div>
    <div class="report-body">
      <div class="info-grid">
        <div class="info-card">
          <div class="info-label">Cliente</div>
          <div class="info-value">${quote.customerName}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Criação</div>
          <div class="info-value">${createdStr}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Validade</div>
          <div class="info-value">${validStr}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Entrega</div>
          <div class="info-value">${deliveryStr}</div>
        </div>
      </div>

      <table class="data-table">
        <thead><tr>
          <th>Produto</th><th>Variáveis</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span class="label">Custo:</span><span class="value">R$ ${quote.totalCost.toFixed(2)}</span></div>
        ${quote.logoCost > 0 ? `<div class="totals-row"><span class="label">Logo:</span><span class="value">R$ ${quote.logoCost.toFixed(2)}</span></div>` : ''}
        <div class="totals-row totals-total"><span class="label">Total:</span><span class="value">R$ ${quote.totalPrice.toFixed(2)}</span></div>
      </div>

      ${quote.notes ? `<div class="notes"><div class="notes-title">Observações</div><div class="notes-text">${quote.notes}</div></div>` : ''}
    </div>
    <div class="report-footer">
      <span class="brand">Elitium ERP</span>
      <span>Gerado em ${dateStr} às ${timeStr}</span>
    </div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function QuotesPage() {
  const [inventory, setInventory] = useState<ProductOption[]>([]);
  const [quotes, setQuotes] = useState<QuoteView[]>([]);
  const [activeSection, setActiveSection] = useState<'list' | 'create'>('list');
  const [statusMessage, setStatusMessage] = useState('');
  const [undoData, setUndoData] = useState<{ message: string; items: QuoteView[]; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Auto-dismiss status messages after 4 seconds
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteView | null>(null);
  const [convertingQuote, setConvertingQuote] = useState<QuoteView | null>(null);
  const [convertDeliveryDate, setConvertDeliveryDate] = useState('');
  const [convertQuoteName, setConvertQuoteName] = useState('');
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [logoAnalysisResult, setLogoAnalysisResult] = useState<{
    totalColors: number;
    colors: { hex: string; rgb: { r: number; g: number; b: number }; name?: string; pixelFraction: number }[];
    productColor: string | null;
    complexity: string;
    description: string;
    source?: string;
  } | null>(null);
  const [logoAnalyzing, setLogoAnalyzing] = useState(false);
  const [logoAnalysisError, setLogoAnalysisError] = useState('');
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
      !!logoFile ||
      cartItems.length > 0 ||
      useDimensions ||
      !!printType ||
      printPosition !== 'front' ||
      printSize !== 'medium' ||
      Object.keys(selectedVariables).some(k => (selectedVariables[k] || 0) > 0) ||
      quantity !== 100;
    setFormIsDirty(isDirty);
  }, [customerName, quoteName, notes, validDays, deliveryDate, logoFile, cartItems, useDimensions, printType, printPosition, printSize, selectedVariables, quantity]);

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

  // Análise de cores da logo via IA
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl('');
      setLogoAnalysisResult(null);
      setLogoAnalysisError('');
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

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

  const logoColors = logoAnalysisResult?.totalColors ?? 0;

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
        customerName, quoteName, notes, validDays, deliveryDate, cartItems,
        useDimensions, dimWidth, dimHeight, printType, printPosition, printSize,
        selectedVariables, quantity,
      }));
    } catch {}
  }, [customerName, quoteName, notes, validDays, deliveryDate, logoFile, cartItems, useDimensions, dimWidth, dimHeight, printType, printPosition, printSize, selectedVariables, quantity]);

  function clearFormState() {
    setCustomerName('');
    setQuoteName('');
    setNotes('');
    setValidDays(globalConfig.quoteValidityDays);
    setDeliveryDate('');
    setSelectedVariables({});
    setQuantity(100);
    setLogoFile(null);
    setLogoPreviewUrl('');
    setLogoAnalysisResult(null);
    setLogoAnalysisError('');
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

  async function handleQuoteAction(quoteId: string, action: 'clone' | 'convert' | 'update-status', status?: string, deliveryDate?: string, name?: string) {
    try {
      const body: Record<string, string> = { quoteId, action };
      if (status) body.status = status;
      if (deliveryDate) body.deliveryDate = deliveryDate;
      if (name) body.name = name;

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

  async function handleUndoDeleteQuotes(deletedItems: QuoteView[]) {
    if (undoData?.timer) clearTimeout(undoData.timer);
    setUndoData(null);
    let restored = 0;
    for (const q of deletedItems) {
      try {
        const resp = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            customerName: q.customerName,
            name: q.name,
            items: q.items,
            logoColors: q.logoCost > 0 ? Math.round(q.logoCost / (globalConfig.logoPricePerColor || 10)) : 0,
            notes: q.notes,
            deliveryDate: q.deliveryDate,
          }),
        });
        if (resp.ok) restored++;
      } catch { /* skip */ }
    }
    setStatusMessage(`${restored} orçamento(s) restaurado(s)!`);
    await loadQuotes();
  }

  function showUndoToast(message: string, items: QuoteView[]) {
    if (undoData?.timer) clearTimeout(undoData.timer);
    const timer = setTimeout(() => setUndoData(null), 10000);
    setUndoData({ message, items, timer });
  }

  async function handleDeleteQuote(quoteId: string) {
    if (!confirm('Tem certeza que deseja remover este orçamento?')) return;
    const quoteToDelete = quotes.find(q => q.id === quoteId);
    try {
      const response = await fetch(`/api/quotes?quoteId=${quoteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await safeJson(response);
      if (response.ok) {
        if (quoteToDelete) showUndoToast('Orçamento removido.', [quoteToDelete]);
        else setStatusMessage('Orçamento removido.');
        await loadQuotes();
      } else {
        setStatusMessage(data.error || 'Erro ao remover.');
      }
    } catch { setStatusMessage('Erro de conexão.'); }
  }

  async function handleBulkDeleteQuotes() {
    if (selectedQuoteIds.size === 0) return;
    const count = selectedQuoteIds.size;
    if (!confirm(`Tem certeza que deseja remover ${count} orçamento(s)?`)) return;

    const deletedItems: QuoteView[] = [];
    let removed = 0;
    let errors = 0;
    for (const id of selectedQuoteIds) {
      const quoteToDelete = quotes.find(q => q.id === id);
      try {
        const response = await fetch(`/api/quotes?quoteId=${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (response.ok) { removed++; if (quoteToDelete) deletedItems.push(quoteToDelete); }
        else errors++;
      } catch { errors++; }
    }

    setSelectedQuoteIds(new Set());
    if (removed > 0) {
      showUndoToast(`${removed} orçamento(s) removido(s).`, deletedItems);
    } else if (errors > 0) {
      setStatusMessage(`${errors} erro(s) ao remover.`);
    }
    await loadQuotes();
  }

  function toggleQuoteSelection(id: string) {
    setSelectedQuoteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllQuotes() {
    setSelectedQuoteIds(prev => {
      if (prev.size === filteredQuotes.length) return new Set();
      return new Set(filteredQuotes.map(q => q.id));
    });
  }

  function handleOpenConvertModal(quote: QuoteView) {
    setConvertingQuote(quote);
    setConvertDeliveryDate(quote.deliveryDate || '');
    setConvertQuoteName(quote.name);
  }

  async function handleConfirmConvert() {
    if (!convertingQuote) return;
    if (!convertDeliveryDate) {
      setStatusMessage('A data de entrega é obrigatória para converter em pedido.');
      return;
    }
    await handleQuoteAction(convertingQuote.id, 'convert', undefined, convertDeliveryDate, convertQuoteName.trim() || undefined);
    setConvertingQuote(null);
    setConvertDeliveryDate('');
    setConvertQuoteName('');
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
                {/* Barra de seleção múltipla */}
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedQuoteIds.size === filteredQuotes.length && filteredQuotes.length > 0}
                      onChange={toggleAllQuotes}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>Selecionar todos</span>
                  </label>
                  {selectedQuoteIds.size > 0 && (
                    <>
                      <span className="text-xs text-slate-500">{selectedQuoteIds.size} selecionado(s)</span>
                      <button
                        type="button"
                        onClick={() => void handleBulkDeleteQuotes()}
                        className="ml-auto rounded-lg px-4 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: 'var(--danger)', color: '#fff' }}
                      >
                        🗑 Remover selecionados
                      </button>
                    </>
                  )}
                </div>

                {filteredQuotes.map(quote => {
                  const sl = statusLabel(quote.status);
                  return (
                    <div key={quote.id}
                      className="cursor-pointer rounded-xl border border-slate-200 p-5 transition-all hover:border-slate-300 hover:shadow-md"
                      onClick={() => setSelectedQuote(quote)}>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedQuoteIds.has(quote.id)}
                            onChange={() => toggleQuoteSelection(quote.id)}
                            onClick={e => e.stopPropagation()}
                            className="mt-1 h-4 w-4 rounded border-slate-300 cursor-pointer"
                          />
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

                          <button type="button" onClick={() => generateQuotePDF(quote)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                            📄 PDF
                          </button>

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
                  <p className="text-xs text-slate-400">Opcional — pode ser definida ao converter em pedido.</p>
                </label>
                <div className="space-y-2 text-slate-700">
                  <span>Logo (análise automática de cores)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                  {logoAnalyzing ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--brand)]">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analisando cores da logo…
                    </div>
                  ) : logoAnalysisError ? (
                    <p className="text-xs text-red-600">{logoAnalysisError}</p>
                  ) : logoAnalysisResult ? (
                    <div className="space-y-2">
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
                  ) : logoPreviewUrl ? (
                    <p className="text-xs text-slate-500">Aguardando análise…</p>
                  ) : (
                    <p className="text-xs text-slate-400">Faça upload da logo para detectar as cores automaticamente.</p>
                  )}
                </div>
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
                <button type="button" onClick={() => generateQuotePDF(selectedQuote)}
                  className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                  📄 Baixar PDF
                </button>
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
                Para converter este orçamento em pedido, confirme ou altere os dados abaixo.
              </p>

              <label className="mt-4 block space-y-2 text-slate-700">
                <span>Nome do pedido</span>
                <input
                  type="text"
                  value={convertQuoteName}
                  onChange={e => setConvertQuoteName(e.target.value)}
                  placeholder="Nome do orçamento/pedido"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                />
              </label>

              <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Cliente</p>
                <p className="mt-1 font-semibold text-slate-900">{convertingQuote.customerName}</p>
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">R$ {convertingQuote.totalPrice.toFixed(2)}</p>
              </div>

              <label className="mt-3 block space-y-2 text-slate-700">
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

        {/* Toast de status — barra fixa embaixo */}
        {statusMessage && (
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
        )}

        {/* Toast de undo para remoção de orçamentos */}
        {undoData && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 px-6 py-3 text-sm text-white shadow-lg">
            <span>{undoData.message}</span>
            <button
              type="button"
              onClick={() => void handleUndoDeleteQuotes(undoData.items)}
              className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/30"
            >
              ↩ Desfazer
            </button>
            <button type="button" onClick={() => { if (undoData.timer) clearTimeout(undoData.timer); setUndoData(null); }} className="ml-1 text-white/60 hover:text-white">✕</button>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}

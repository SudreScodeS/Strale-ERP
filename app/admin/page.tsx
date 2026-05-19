'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent } from 'react';
import { PageHeader } from '../components/ui';
import { setGlobalDirty } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import type { PrintType, PrintPricingRule, PriceTier } from '../../types';

interface ConfigData {
  profitMargin: number;
  logoPricePerColor: number;
  systemName: string;
  companyName: string;
  quoteValidityDays: number;
  pricePerCm2: number;
  printTypes: PrintType[];
  printPricingRules: PrintPricingRule[];
  priceTiers: PriceTier[];
}

const PAGE_PATH = '/admin';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'rules', visible: true, order: 0, colSpan: 2 },
  { id: 'price-tiers', visible: true, order: 1, colSpan: 2 },
  { id: 'print-types', visible: true, order: 2, colSpan: 2 },
  { id: 'print-pricing', visible: true, order: 3, colSpan: 2 },
  { id: 'preview', visible: true, order: 4, colSpan: 2 },
  { id: 'actions', visible: true, order: 5, colSpan: 2 },
];

export default function AdminPage() {
  const [config, setConfig] = useState<ConfigData>({
    profitMargin: 20,
    logoPricePerColor: 10,
    systemName: '',
    companyName: '',
    quoteValidityDays: 7,
    pricePerCm2: 0.005,
    printTypes: [],
    printPricingRules: [],
    priceTiers: [],
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [saving, setSaving] = useState(false);
  const [newPrintType, setNewPrintType] = useState({ value: '', label: '' });
  const [selectedSize, setSelectedSize] = useState<Record<string, 'small' | 'medium' | 'large'>>({});
  const [selectedPos, setSelectedPos] = useState<Record<string, 'front' | 'back' | 'both'>>({});
  const [activePrintType, setActivePrintType] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const savedConfigRef = useRef<string>('');
  const [dirty, setDirty] = useState(false);

  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  // Track dirty state by comparing current config with last saved
  useEffect(() => {
    if (!savedConfigRef.current) return;
    const current = JSON.stringify(config);
    const isDirty = current !== savedConfigRef.current;
    setDirty(isDirty);
    setGlobalDirty(isDirty, {
      message: 'Você tem alterações não salvas nas configurações.',
      onSave: async () => {
        // Trigger form submit programmatically
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
          // Wait a bit for the save to complete
          await new Promise((r) => setTimeout(r, 1000));
        }
      },
      onDiscard: () => {
        // Reload config from server, discarding changes
        void loadConfig();
      },
    });
  }, [config]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  async function loadConfig() {
    try {
      const response = await fetch('/api/v1/config', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.config) {
        setConfig(data.config);
        savedConfigRef.current = JSON.stringify(data.config);
        setDirty(false);
        setGlobalDirty(false);
      } else {
        setMessage(data.message || 'Erro ao carregar configurações.');
        setMessageType('error');
      }
    } catch {
      setMessage('Erro ao conectar com o servidor.');
      setMessageType('error');
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/v1/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Configurações salvas com sucesso! As alterações já estão ativas no sistema.');
        setMessageType('success');
        if (data.config) {
          setConfig(data.config);
          savedConfigRef.current = JSON.stringify(data.config);
          setDirty(false);
          setGlobalDirty(false);
        }
      } else {
        setMessage(data.message || 'Erro ao salvar configurações.');
        setMessageType('error');
      }
    } catch {
      setMessage('Erro ao conectar com o servidor.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader
          title="Administração"
          description="Configure parâmetros globais do sistema. As alterações são aplicadas imediatamente e persistem no servidor."
        />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {message ? (
          <div
            className="mb-6 rounded-2xl p-4 text-sm font-medium"
            style={{
              background: messageType === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: messageType === 'success' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${messageType === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            }}
          >
            {message}
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-8">
          {sections.map((section, index) => (
            <DraggableSection
              key={`${section.id}-${section.order}`}
              pagePath={PAGE_PATH}
              section={section}
              index={index}
              totalSections={sections.length}
            >
              {section.id === 'rules' && (
                <section
                  className="rounded-2xl p-6 shadow-sm"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <div className="mb-6">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      Regras de Negocio
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Configure margens, preços e limites que afetam cálculos em todo o sistema.
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Margem de Lucro (%)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        step={0.5}
                        value={config.profitMargin}
                        onChange={(e) => setConfig((prev) => ({ ...prev, profitMargin: Number(e.target.value) }))}
                        className="w-full rounded-xl px-4 py-3 text-sm transition-all"
                        style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Ex: 20 = custo + 20%. Atual: {config.profitMargin}%
                      </p>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Preço por Cor na Logo (R$)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={config.logoPricePerColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, logoPricePerColor: Number(e.target.value) }))}
                        className="w-full rounded-xl px-4 py-3 text-sm transition-all"
                        style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Custo adicional por cor detectada na logo do cliente.
                      </p>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Validade Padrão do Orçamento (dias)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={config.quoteValidityDays}
                        onChange={(e) => setConfig((prev) => ({ ...prev, quoteValidityDays: Number(e.target.value) }))}
                        className="w-full rounded-xl px-4 py-3 text-sm transition-all"
                        style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Dias até o orçamento expirar. Atual: {config.quoteValidityDays} dias
                      </p>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Preço por cm² (R$)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        value={config.pricePerCm2}
                        onChange={(e) => setConfig((prev) => ({ ...prev, pricePerCm2: Number(e.target.value) }))}
                        className="w-full rounded-xl px-4 py-3 text-sm transition-all"
                        style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Para cálculo por dimensão (sacolas, banners). 0 = desativado
                      </p>
                    </label>
                  </div>
                </section>
              )}

              {section.id === 'price-tiers' && (
                <section
                  className="rounded-2xl p-6 shadow-sm"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <div className="mb-6">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      Tabela de Preços por Quantidade
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Desconto progressivo por volume. O desconto é aplicado sobre o preço base do produto.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--card-border)' }}>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Faixa</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Qtd Mín</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Qtd Máx</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Desconto %</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Exemplo (R$20 base)</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.priceTiers.map((tier, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--surface-muted)' }}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={tier.label || ''}
                                onChange={(e) => {
                                  const updated = [...config.priceTiers];
                                  updated[i] = { ...updated[i], label: e.target.value };
                                  setConfig((prev) => ({ ...prev, priceTiers: updated }));
                                }}
                                placeholder="Ex: Atacado"
                                className="w-full rounded-lg px-3 py-1.5 text-sm"
                                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={1}
                                value={tier.minQty}
                                onChange={(e) => {
                                  const updated = [...config.priceTiers];
                                  updated[i] = { ...updated[i], minQty: parseInt(e.target.value) || 1 };
                                  setConfig((prev) => ({ ...prev, priceTiers: updated }));
                                }}
                                className="w-24 rounded-lg px-3 py-1.5 text-sm"
                                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                value={tier.maxQty ?? ''}
                                onChange={(e) => {
                                  const updated = [...config.priceTiers];
                                  updated[i] = { ...updated[i], maxQty: e.target.value ? parseInt(e.target.value) : undefined };
                                  setConfig((prev) => ({ ...prev, priceTiers: updated }));
                                }}
                                placeholder="∞"
                                className="w-24 rounded-lg px-3 py-1.5 text-sm"
                                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={tier.discountPercent ?? 0}
                                  onChange={(e) => {
                                    const updated = [...config.priceTiers];
                                    updated[i] = { ...updated[i], discountPercent: parseFloat(e.target.value) || 0, unitPrice: 0 };
                                    setConfig((prev) => ({ ...prev, priceTiers: updated }));
                                  }}
                                  className="w-20 rounded-lg px-3 py-1.5 text-sm"
                                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                />
                                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                              {tier.discountPercent && tier.discountPercent > 0
                                ? `R$ ${(20 * (1 - tier.discountPercent / 100)).toFixed(2)}`
                                : 'R$ 20,00'}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = config.priceTiers.filter((_, j) => j !== i);
                                  setConfig((prev) => ({ ...prev, priceTiers: updated }));
                                }}
                                className="rounded-lg p-1.5 transition-colors"
                                style={{ color: 'var(--text-faint)' }}
                                title="Remover faixa"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const lastTier = config.priceTiers[config.priceTiers.length - 1];
                      const newMinQty = lastTier ? (lastTier.maxQty ? lastTier.maxQty + 1 : lastTier.minQty * 5) : 1;
                      setConfig((prev) => ({
                        ...prev,
                        priceTiers: [
                          ...prev.priceTiers,
                          { minQty: newMinQty, maxQty: undefined, unitPrice: 0, discountPercent: 0, label: '' },
                        ],
                      }));
                    }}
                    className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px dashed var(--card-border)' }}
                  >
                    + Adicionar faixa
                  </button>

                  <p className="mt-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                    Exemplo: 10% de desconto em 500+ unidades → produto de R$20,00 sai por R$18,00.
                  </p>
                </section>
              )}

              {section.id === 'print-types' && (
                <section
                  className="rounded-2xl p-6 shadow-sm"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <div className="mb-6">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      Tipos de Impressão
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Adicione ou remova tipos de impressão disponíveis no sistema.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {config.printTypes.map((pt) => (
                      <div
                        key={pt.value}
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{ background: 'var(--surface-muted)' }}
                      >
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={pt.value}
                            onChange={(e) => {
                              const old = pt.value;
                              const updated = config.printTypes.map((t) =>
                                t.value === old ? { ...t, value: e.target.value } : t,
                              );
                              // Atualiza referências nas regras de preço
                              const updatedRules = config.printPricingRules.map((r) =>
                                r.printType === old ? { ...r, printType: e.target.value } : r,
                              );
                              setConfig((prev) => ({ ...prev, printTypes: updated, printPricingRules: updatedRules }));
                            }}
                            placeholder="ID (ex: serigrafia)"
                            className="rounded-lg px-3 py-2 text-sm"
                            style={{
                              background: 'var(--input-bg)',
                              border: '1px solid var(--input-border)',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <input
                            type="text"
                            value={pt.label}
                            onChange={(e) => {
                              setConfig((prev) => ({
                                ...prev,
                                printTypes: prev.printTypes.map((t) =>
                                  t.value === pt.value ? { ...t, label: e.target.value } : t,
                                ),
                              }));
                            }}
                            placeholder="Nome exibido (ex: Serigrafia)"
                            className="rounded-lg px-3 py-2 text-sm"
                            style={{
                              background: 'var(--input-bg)',
                              border: '1px solid var(--input-border)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setConfig((prev) => ({
                              ...prev,
                              printTypes: prev.printTypes.filter((t) => t.value !== pt.value),
                              // Remove regras de preço associadas
                              printPricingRules: prev.printPricingRules.filter((r) => r.printType !== pt.value),
                            }));
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                          title="Remover tipo"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {/* Formulário para adicionar novo tipo */}
                    <div
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'var(--surface-muted)', border: '2px dashed var(--border)' }}
                    >
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newPrintType.value}
                          onChange={(e) => setNewPrintType((prev) => ({ ...prev, value: e.target.value }))}
                          placeholder="ID (ex: bordado)"
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--input-border)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <input
                          type="text"
                          value={newPrintType.label}
                          onChange={(e) => setNewPrintType((prev) => ({ ...prev, label: e.target.value }))}
                          placeholder="Nome exibido (ex: Bordado)"
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--input-border)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newPrintType.value.trim() || !newPrintType.label.trim()) return;
                          if (config.printTypes.some((t) => t.value === newPrintType.value.trim())) return;
                          setConfig((prev) => ({
                            ...prev,
                            printTypes: [...prev.printTypes, { value: newPrintType.value.trim(), label: newPrintType.label.trim() }],
                          }));
                          setNewPrintType({ value: '', label: '' });
                        }}
                        disabled={!newPrintType.value.trim() || !newPrintType.label.trim()}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-40"
                        style={{ background: 'var(--brand)' }}
                        title="Adicionar tipo"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 text-xs" style={{ color: 'var(--text-faint)' }}>
                    Ao remover um tipo, todas as regras de preço associadas também serão removidas.
                  </p>
                </section>
              )}

              {section.id === 'print-pricing' && (
                <section
                  className="rounded-2xl p-6 shadow-sm"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <div className="mb-6">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      Preços de Impressão
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Selecione um tipo para configurar os preços.
                    </p>
                  </div>

                  {config.printTypes.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Nenhum tipo de impressão configurado. Adicione tipos na seção acima.
                    </p>
                  ) : (
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)' }}>
                      {/* Botões dos tipos com setas de scroll */}
                      <div className="relative mb-5 flex items-center gap-2">
                        {/* Seta esquerda */}
                        {config.printTypes.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setScrollOffset((o) => Math.max(0, o - 1))}
                            disabled={scrollOffset === 0}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                            style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                        )}

                        {/* Container dos botões */}
                        <div className="flex flex-1 gap-2 overflow-hidden">
                          {config.printTypes.slice(scrollOffset, scrollOffset + 3).map((pt) => {
                            const isActive = activePrintType === pt.value;
                            return (
                              <button
                                key={pt.value}
                                type="button"
                                onClick={() => setActivePrintType(pt.value)}
                                className="flex-1 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-medium transition-all"
                                style={{
                                  background: isActive ? 'var(--brand)' : 'var(--input-bg)',
                                  color: isActive ? '#fff' : 'var(--text-secondary)',
                                  border: isActive ? 'none' : '1px solid var(--border)',
                                }}
                              >
                                {pt.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Seta direita */}
                        {config.printTypes.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setScrollOffset((o) => Math.min(config.printTypes.length - 3, o + 1))}
                            disabled={scrollOffset >= config.printTypes.length - 3}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                            style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Editor do tipo selecionado */}
                      {activePrintType && (() => {
                        const pt = config.printTypes.find((t) => t.value === activePrintType);
                        if (!pt) return null;

                        const curSize = selectedSize[pt.value] || 'medium';
                        const curPos = selectedPos[pt.value] || 'front';
                        const rule = config.printPricingRules.find(
                          (r) => r.printType === pt.value && r.size === curSize && r.position === curPos,
                        );

                        const sizes: Array<{ value: 'small' | 'medium' | 'large'; label: string }> = [
                          { value: 'small', label: 'Pequeno' },
                          { value: 'medium', label: 'Médio' },
                          { value: 'large', label: 'Grande' },
                        ];
                        const positions: Array<{ value: 'front' | 'back' | 'both'; label: string }> = [
                          { value: 'front', label: 'Frente' },
                          { value: 'back', label: 'Verso' },
                          { value: 'both', label: 'Ambos' },
                        ];

                        function updateRule(field: 'baseCost' | 'costPerColor', val: number) {
                          setConfig((prev) => {
                            const exists = prev.printPricingRules.find(
                              (r) => r.printType === pt!.value && r.size === curSize && r.position === curPos,
                            );
                            if (exists) {
                              return {
                                ...prev,
                                printPricingRules: prev.printPricingRules.map((r) =>
                                  r.printType === pt!.value && r.size === curSize && r.position === curPos
                                    ? { ...r, [field]: val }
                                    : r,
                                ),
                              };
                            }
                            return {
                              ...prev,
                              printPricingRules: [
                                ...prev.printPricingRules,
                                { printType: pt!.value, size: curSize, position: curPos, baseCost: 0, costPerColor: 0, [field]: val },
                              ],
                            };
                          });
                        }

                        return (
                          <div>
                            {/* Botões de tamanho */}
                            <div className="mb-3">
                              <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tamanho</span>
                              <div className="inline-flex gap-1 rounded-lg p-1" style={{ background: 'var(--input-bg)' }}>
                                {sizes.map((s) => (
                                  <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setSelectedSize((prev) => ({ ...prev, [pt!.value]: s.value }))}
                                    className="rounded-md px-4 py-1.5 text-xs font-medium transition-all"
                                    style={{
                                      background: curSize === s.value ? 'var(--brand)' : 'transparent',
                                      color: curSize === s.value ? '#fff' : 'var(--text-secondary)',
                                    }}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Botões de posição */}
                            <div className="mb-4">
                              <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Posição</span>
                              <div className="inline-flex gap-1 rounded-lg p-1" style={{ background: 'var(--input-bg)' }}>
                                {positions.map((p) => (
                                  <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => setSelectedPos((prev) => ({ ...prev, [pt!.value]: p.value }))}
                                    className="rounded-md px-4 py-1.5 text-xs font-medium transition-all"
                                    style={{
                                      background: curPos === p.value ? 'var(--brand)' : 'transparent',
                                      color: curPos === p.value ? '#fff' : 'var(--text-secondary)',
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Campos de preço */}
                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block space-y-1">
                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Custo Base (R$)</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={rule?.baseCost ?? 0}
                                  onChange={(e) => updateRule('baseCost', Number(e.target.value))}
                                  className="w-full rounded-lg px-3 py-2 text-sm"
                                  style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--text-primary)',
                                  }}
                                />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Custo por Cor (R$)</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={rule?.costPerColor ?? 0}
                                  onChange={(e) => updateRule('costPerColor', Number(e.target.value))}
                                  className="w-full rounded-lg px-3 py-2 text-sm"
                                  style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--text-primary)',
                                  }}
                                />
                              </label>
                            </div>

                            <p className="mt-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                              {pt.label} → {sizes.find((s) => s.value === curSize)?.label} × {positions.find((p) => p.value === curPos)?.label}
                            </p>
                          </div>
                        );
                      })()}

                      {!activePrintType && (
                        <div
                          className="rounded-lg p-6 text-center"
                          style={{ border: '2px dashed var(--border)' }}
                        >
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Selecione um tipo acima para configurar os preços.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {section.id === 'preview' && (
                <section
                  className="rounded-2xl p-6 shadow-sm"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    Preview dos Efeitos
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Exemplo: Custo R$ 100</p>
                      <p className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        → R$ {(100 + (100 * config.profitMargin) / 100).toFixed(2)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>com {config.profitMargin}% margem</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Logo com 3 cores</p>
                      <p className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        → R$ {(3 * config.logoPricePerColor).toFixed(2)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{config.logoPricePerColor} × 3 cores</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Orçamento válido por</p>
                      <p className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        {config.quoteValidityDays} dias
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>padrão para novos orçamentos</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sacola 30×40cm</p>
                      <p className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        + R$ {(30 * 40 * config.pricePerCm2).toFixed(2)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>custo por dimensão (se ativo)</p>
                    </div>
                  </div>
                </section>
              )}

              {section.id === 'actions' && (
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'var(--brand)' }}
                  >
                    {saving ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Salvando…
                      </>
                    ) : (
                      'Salvar Configurações'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadConfig()}
                    className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-medium transition-colors"
                    style={{
                      background: 'var(--surface-muted)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {dirty ? 'Descartar alterações' : 'Restaurar padrão'}
                  </button>
                </div>
              )}
            </DraggableSection>
          ))}
        </form>

        {/* Floating unsaved changes bar — portal to body for true fixed positioning */}
        {dirty && createPortal(
          <div
            className="fixed bottom-0 left-0 right-0 z-[90] flex items-center justify-center gap-4 px-6 py-3"
            style={{
              background: 'var(--card-bg)',
              borderTop: '2px solid var(--warning, #f59e0b)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--warning, #f59e0b)' }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'var(--warning, #f59e0b)' }} />
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Você tem alterações não salvas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadConfig()}
                className="rounded-lg px-4 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: 'var(--surface-muted)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={() => {
                  const form = document.querySelector('form');
                  if (form) form.requestSubmit();
                }}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'var(--brand)' }}
              >
                Salvar agora
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </ProtectedPage>
  );
}

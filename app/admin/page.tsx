'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import type { PrintType, PrintPricingRule } from '../../types';

interface ConfigData {
  profitMargin: number;
  logoPricePerColor: number;
  systemName: string;
  companyName: string;
  quoteValidityDays: number;
  pricePerCm2: number;
  printTypes: PrintType[];
  printPricingRules: PrintPricingRule[];
}

const PAGE_PATH = '/admin';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'rules', visible: true, order: 0, colSpan: 2 },
  { id: 'print-types', visible: true, order: 1, colSpan: 2 },
  { id: 'print-pricing', visible: true, order: 2, colSpan: 2 },
  { id: 'preview', visible: true, order: 3, colSpan: 2 },
  { id: 'actions', visible: true, order: 4, colSpan: 2 },
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
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [saving, setSaving] = useState(false);
  const [newPrintType, setNewPrintType] = useState({ value: '', label: '' });

  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  async function loadConfig() {
    try {
      const response = await fetch('/api/config', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.config) {
        setConfig(data.config);
      } else {
        setMessage(data.error || 'Erro ao carregar configurações.');
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
      const response = await fetch('/api/config', {
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
        }
      } else {
        setMessage(data.error || 'Erro ao salvar configurações.');
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
                      Configure o custo base e adicional por cor para cada tipo, tamanho e posição.
                    </p>
                  </div>

                  {config.printTypes.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Nenhum tipo de impressão configurado. Adicione tipos na seção acima.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {config.printTypes.map((pt) => {
                        const typeRules = config.printPricingRules.filter((r) => r.printType === pt.value);
                        const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
                        const positions: Array<'front' | 'back' | 'both'> = ['front', 'back', 'both'];

                        return (
                          <div key={pt.value} className="rounded-xl p-4" style={{ background: 'var(--surface-muted)' }}>
                            <div className="mb-4 flex items-center justify-between">
                              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                {pt.label}
                              </h4>
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--brand-bg)', color: 'var(--brand)' }}>
                                {typeRules.length} regras
                              </span>
                            </div>

                            {/* Tabela de preços */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="pb-2 pr-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Tamanho</th>
                                    <th className="pb-2 pr-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Posição</th>
                                    <th className="pb-2 pr-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Custo Base (R$)</th>
                                    <th className="pb-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Custo/Cor (R$)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sizes.map((size) =>
                                    positions.map((pos) => {
                                      const rule = typeRules.find((r) => r.size === size && r.position === pos);
                                      const sizeLabel = size === 'small' ? 'Pequeno' : size === 'medium' ? 'Médio' : 'Grande';
                                      const posLabel = pos === 'front' ? 'Frente' : pos === 'back' ? 'Verso' : 'Ambos';

                                      return (
                                        <tr key={`${size}-${pos}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                                          <td className="py-2 pr-3" style={{ color: 'var(--text-secondary)' }}>{sizeLabel}</td>
                                          <td className="py-2 pr-3" style={{ color: 'var(--text-secondary)' }}>{posLabel}</td>
                                          <td className="py-2 pr-3">
                                            <input
                                              type="number"
                                              min={0}
                                              step={0.5}
                                              value={rule?.baseCost ?? 0}
                                              onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setConfig((prev) => {
                                                  const exists = prev.printPricingRules.find(
                                                    (r) => r.printType === pt.value && r.size === size && r.position === pos,
                                                  );
                                                  if (exists) {
                                                    return {
                                                      ...prev,
                                                      printPricingRules: prev.printPricingRules.map((r) =>
                                                        r.printType === pt.value && r.size === size && r.position === pos
                                                          ? { ...r, baseCost: val }
                                                          : r,
                                                      ),
                                                    };
                                                  }
                                                  return {
                                                    ...prev,
                                                    printPricingRules: [
                                                      ...prev.printPricingRules,
                                                      { printType: pt.value, size, position: pos, baseCost: val, costPerColor: 0 },
                                                    ],
                                                  };
                                                });
                                              }}
                                              className="w-24 rounded-lg px-2 py-1.5 text-sm"
                                              style={{
                                                background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                color: 'var(--text-primary)',
                                              }}
                                            />
                                          </td>
                                          <td className="py-2">
                                            <input
                                              type="number"
                                              min={0}
                                              step={0.5}
                                              value={rule?.costPerColor ?? 0}
                                              onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setConfig((prev) => {
                                                  const exists = prev.printPricingRules.find(
                                                    (r) => r.printType === pt.value && r.size === size && r.position === pos,
                                                  );
                                                  if (exists) {
                                                    return {
                                                      ...prev,
                                                      printPricingRules: prev.printPricingRules.map((r) =>
                                                        r.printType === pt.value && r.size === size && r.position === pos
                                                          ? { ...r, costPerColor: val }
                                                          : r,
                                                      ),
                                                    };
                                                  }
                                                  return {
                                                    ...prev,
                                                    printPricingRules: [
                                                      ...prev.printPricingRules,
                                                      { printType: pt.value, size, position: pos, baseCost: 0, costPerColor: val },
                                                    ],
                                                  };
                                                });
                                              }}
                                              className="w-24 rounded-lg px-2 py-1.5 text-sm"
                                              style={{
                                                background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                color: 'var(--text-primary)',
                                              }}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    }),
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
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
                <div className="flex items-center gap-4">
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
                    Restaurar padrão
                  </button>
                </div>
              )}
            </DraggableSection>
          ))}
        </form>
      </div>
    </ProtectedPage>
  );
}

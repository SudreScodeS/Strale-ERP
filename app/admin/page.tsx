'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

interface ConfigData {
  profitMargin: number;
  logoPricePerColor: number;
  systemName: string;
  companyName: string;
}

const PAGE_PATH = '/admin';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'rules', visible: true, order: 0, colSpan: 2 },
  { id: 'preview', visible: true, order: 1, colSpan: 2 },
  { id: 'actions', visible: true, order: 2, colSpan: 2 },
];

export default function AdminPage() {
  const [config, setConfig] = useState<ConfigData>({
    profitMargin: 20,
    logoPricePerColor: 10,
    systemName: '',
    companyName: '',
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [saving, setSaving] = useState(false);

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
                  </div>
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
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                  </div>
                </section>
              )}

              {section.id === 'actions' && (
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'var(--brand-blue)' }}
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

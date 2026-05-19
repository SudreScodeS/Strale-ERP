'use client';

// ── CommandPalette.tsx — Full-screen overlay command palette (Ctrl+K) ─

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  section: string;
  keywords: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Define all command items
  const items: CommandItem[] = [
    // Pages
    { id: 'dashboard', label: 'Dashboard', icon: '📊', shortcut: 'Alt+1', section: 'Páginas', keywords: ['home', 'inicio', 'painel'], action: () => { router.push('/'); onClose(); } },
    { id: 'sales', label: 'Pedidos', icon: '🛒', shortcut: 'Alt+2', section: 'Páginas', keywords: ['vendas', 'orders', 'pedidos'], action: () => { router.push('/sales'); onClose(); } },
    { id: 'quotes', label: 'Orçamentos', icon: '📋', shortcut: 'Alt+3', section: 'Páginas', keywords: ['quotes', 'orcamentos', 'proposta'], action: () => { router.push('/quotes'); onClose(); } },
    { id: 'inventory', label: 'Estoque', icon: '📦', shortcut: 'Alt+4', section: 'Páginas', keywords: ['stock', 'products', 'inventario'], action: () => { router.push('/inventory'); onClose(); } },
    { id: 'finance', label: 'Financeiro', icon: '💰', shortcut: 'Alt+5', section: 'Páginas', keywords: ['financeiro', 'receita', 'despesa', 'lucro'], action: () => { router.push('/finance'); onClose(); } },
    { id: 'assistant', label: 'Assistente IA', icon: '🤖', shortcut: 'Alt+6', section: 'Páginas', keywords: ['ai', 'chat', 'assistente', 'ajuda'], action: () => { router.push('/assistant'); onClose(); } },
    { id: 'purchases', label: 'Compras', icon: '🛍️', section: 'Páginas', keywords: ['compras', 'fornecedor', 'purchase'], action: () => { router.push('/purchases'); onClose(); } },
    { id: 'reports', label: 'Relatórios', icon: '📈', section: 'Páginas', keywords: ['relatorio', 'report', 'analise'], action: () => { router.push('/reports'); onClose(); } },
    { id: 'demand', label: 'Previsão de Demanda', icon: '🔮', section: 'Páginas', keywords: ['previsao', 'demanda', 'forecast'], action: () => { router.push('/demand-forecast'); onClose(); } },
    { id: 'users', label: 'Usuários', icon: '👥', section: 'Páginas', keywords: ['usuarios', 'users', 'equipe'], action: () => { router.push('/users'); onClose(); } },
    { id: 'notifications', label: 'Notificações', icon: '🔔', section: 'Páginas', keywords: ['notificacao', 'alerta', 'notification'], action: () => { router.push('/notifications'); onClose(); } },
    { id: 'settings', label: 'Configurações', icon: '⚙️', section: 'Páginas', keywords: ['configuracao', 'settings', 'admin'], action: () => { router.push('/admin'); onClose(); } },

    // Quick actions
    { id: 'new-order', label: 'Novo Pedido', icon: '➕', section: 'Ações Rápidas', keywords: ['criar', 'novo', 'pedido', 'venda'], action: () => { router.push('/sales'); onClose(); } },
    { id: 'new-quote', label: 'Novo Orçamento', icon: '📝', section: 'Ações Rápidas', keywords: ['criar', 'novo', 'orcamento', 'proposta'], action: () => { router.push('/quotes'); onClose(); } },
    { id: 'ask-ai', label: 'Perguntar ao Assistente', icon: '💬', section: 'Ações Rápidas', keywords: ['perguntar', 'ajuda', 'duvida', 'ai'], action: () => { router.push('/assistant'); onClose(); } },
    { id: 'low-stock', label: 'Ver Estoque Baixo', icon: '⚠️', section: 'Ações Rápidas', keywords: ['estoque', 'baixo', 'critico', 'alerta'], action: () => { router.push('/inventory'); onClose(); } },
  ];

  // Fuzzy search
  const filtered = query.trim() === ''
    ? items
    : items.filter(item => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q)) ||
          item.keywords.some(k => k.includes(q)) ||
          item.section.toLowerCase().includes(q)
        );
      });

  // Group by section
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filtered, selectedIndex, onClose]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      style={{ background: 'var(--modal-overlay)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas e ações..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Nenhum resultado para &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([section, sectionItems]) => (
              <div key={section}>
                <p
                  className="mb-1 px-4 pt-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {section}
                </p>
                {sectionItems.map((item) => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={item.action}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors"
                      style={{
                        background: isSelected ? 'var(--surface-muted)' : 'transparent',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="flex-shrink-0 text-base">{item.icon}</span>
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      {item.shortcut && (
                        <kbd
                          className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 px-4 py-2 text-[10px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}
        >
          <span className="flex items-center gap-1">
            <kbd className="rounded px-1 py-0.5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>↑↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded px-1 py-0.5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>↵</kbd>
            selecionar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded px-1 py-0.5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>esc</kbd>
            fechar
          </span>
        </div>
      </div>
    </div>
  );
}

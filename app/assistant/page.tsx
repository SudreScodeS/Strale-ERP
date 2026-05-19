'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../lib/authClient';
import { globalConfig } from '../../config/global';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import { ErrorBoundary } from '../components/error-boundary';

// ── Types ──────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source?: string;
  toolsUsed?: string[];
  isStreaming?: boolean;
}

interface OllamaStatus {
  available: boolean;
  model?: string;
  models?: string[];
  error?: string;
}

// ── Suggestions ────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'Resumo do sistema', icon: '📊' },
  { label: 'Produto mais vendido', icon: '🏆' },
  { label: 'Estoque baixo', icon: '⚠️' },
  { label: 'Lucro total', icon: '💰' },
  { label: 'Pedidos recentes', icon: '🛒' },
  { label: 'Entregas urgentes', icon: '🚚' },
  { label: 'Previsão de demanda', icon: '📈' },
  { label: 'Orçamentos pendentes', icon: '📋' },
  { label: 'Ticket médio', icon: '🎯' },
  { label: 'Vendas por período', icon: '📅' },
  { label: 'Quanto custa 500 sacolas TNT?', icon: '💲' },
  { label: 'Fornecedores', icon: '🏭' },
];

const PAGE_PATH = '/assistant';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'chat', visible: true, order: 0, colSpan: 2 },
  { id: 'suggestions', visible: true, order: 1, colSpan: 2 },
  { id: 'input', visible: true, order: 2, colSpan: 2 },
];

// ── Chat Bubble ────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  const renderLine = (line: string, idx: number) => {
    if (!line) return <div key={idx} className="h-2" />;

    // Process bold, italic, and inline code
    const parts = line.split(/(\*\*.*?\*\*|_.*?_|`.*?`)/g).filter(Boolean);
    return (
      <div key={idx}>
        {parts.map((part, pi) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pi} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('_') && part.endsWith('_')) {
            return <em key={pi} style={{ color: 'var(--text-muted)' }}>{part.slice(1, -1)}</em>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={pi}
                className="rounded px-1 py-0.5 text-[11px]"
                style={{ background: 'var(--surface-muted)', color: 'var(--brand)' }}
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        })}
      </div>
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? 'rounded-br-md' : 'rounded-bl-md'
        }`}
        style={
          isUser
            ? { background: 'var(--brand)', color: '#ffffff' }
            : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }
        }
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="space-y-1">
            {message.content.split('\n').map(renderLine)}
            {message.isStreaming && (
              <span className="inline-block h-3 w-1.5 animate-pulse" style={{ background: 'var(--brand)' }} />
            )}
          </div>
        )}

        {/* Metadata */}
        <div className={`mt-1.5 flex items-center gap-2 text-[10px] ${isUser ? 'opacity-50' : ''}`} style={isUser ? {} : { color: 'var(--text-faint)' }}>
          <span>{message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          {!isUser && message.source && message.source !== 'pattern' && (
            <span
              className="rounded-full px-1.5 py-0.5"
              style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}
            >
              {message.source === 'cache' ? '⚡ cache' : message.source === 'llm+tools' ? '🧠 IA + dados' : '🧠 IA'}
            </span>
          )}
          {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
            <span style={{ color: 'var(--text-faint)' }}>
              {message.toolsUsed.length} tool{message.toolsUsed.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Source Badge ───────────────────────────────────────────────

function SourceBadge({ source, toolsUsed }: { source?: string; toolsUsed?: string[] }) {
  if (!source) return null;

  const labels: Record<string, { text: string; color: string }> = {
    'llm+tools': { text: '🧠 IA com dados reais', color: 'var(--success)' },
    llm: { text: '🧠 IA', color: 'var(--brand)' },
    pattern: { text: '⚡ Local', color: 'var(--text-muted)' },
    cache: { text: '⚡ Cache', color: 'var(--warning)' },
  };

  const info = labels[source] || { text: source, color: 'var(--text-muted)' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: 'var(--surface-muted)', color: info.color }}
    >
      {info.text}
      {toolsUsed && toolsUsed.length > 0 && (
        <span className="ml-1 opacity-60">({toolsUsed.join(', ')})</span>
      )}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Olá! Sou o assistente do **${globalConfig.systemName}**. Posso consultar vendas, estoque, financeiro, entregas e calcular preços. Como posso ajudar?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  // Check Ollama status
  useEffect(() => {
    fetch('/api/assistant', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setOllamaStatus(data))
      .catch(() => setOllamaStatus({ available: false }));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(async (question?: string) => {
    const q = (question || input).trim();
    if (!q || isLoading) return;

    // Abort any previous request
    abortRef.current?.abort();

    setMessages((prev) => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    setInput('');
    setIsLoading(true);

    // Add placeholder for streaming response
    const assistantIdx = messages.length + 1; // after user message
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ question: q, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || 'Erro ao consultar assistente');
      }

      // SSE streaming
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let source = '';
      let toolsUsed: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            if (event.chunk) fullContent += event.chunk;
            if (event.source) source = event.source;
            if (event.toolsUsed) toolsUsed = event.toolsUsed;

            // Update streaming message
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = {
                  ...last,
                  content: fullContent,
                  isStreaming: !event.done,
                  source: source || last.source,
                  toolsUsed: toolsUsed.length > 0 ? toolsUsed : last.toolsUsed,
                };
              }
              return next;
            });
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: `Erro: ${err instanceof Error ? err.message : 'Não foi possível processar.'}`,
            isStreaming: false,
          };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages.length]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ clear: true }),
    }).catch(() => {});
    setMessages([
      { role: 'assistant', content: 'Conversa limpa. Como posso ajudar?', timestamp: new Date() },
    ]);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
            {globalConfig.systemName}
          </p>
          <h2 className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Assistente IA
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Respostas baseadas em dados reais do sistema
            </p>
            {ollamaStatus && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: ollamaStatus.available ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: ollamaStatus.available ? 'var(--success)' : 'var(--warning)',
                  border: `1px solid ${ollamaStatus.available ? 'var(--success-border)' : 'var(--warning-border)'}`,
                }}
                title={ollamaStatus.error || (ollamaStatus.available ? `Modelo: ${ollamaStatus.model}` : 'Ollama não detectado')}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: ollamaStatus.available ? 'var(--success)' : 'var(--warning)' }}
                />
                {ollamaStatus.available
                  ? `IA: ${ollamaStatus.model || 'Ollama'}`
                  : 'IA: Local (pattern matching)'}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isLoading && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}
            >
              Parar
            </button>
          )}
          <button
            onClick={handleClear}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            Limpar
          </button>
        </div>
      </div>

      <LayoutToolbar pagePath={PAGE_PATH} />

      {sections.map((section, index) => (
        <DraggableSection
          key={`${section.id}-${section.order}`}
          pagePath={PAGE_PATH}
          section={section}
          index={index}
          totalSections={sections.length}
        >
          {section.id === 'chat' && (
            <ErrorBoundary name="Chat">
              <div
                className="flex-1 overflow-y-auto rounded-xl p-5"
                style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)', minHeight: '200px' }}
              >
                {messages.map((msg, i) => (
                  <ChatBubble key={i} message={msg} />
                ))}

                <div ref={messagesEndRef} />
              </div>
            </ErrorBoundary>
          )}

          {section.id === 'suggestions' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSend(s.label.toLowerCase())}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all disabled:opacity-50"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand)';
                    e.currentTarget.style.color = 'var(--brand)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {section.id === 'input' && (
            <div className="mt-3 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta..."
                disabled={isLoading}
                className="flex-1 rounded-xl px-4 py-3 text-sm transition-all disabled:opacity-50"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--brand)' }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processando...
                  </span>
                ) : 'Enviar'}
              </button>
            </div>
          )}
        </DraggableSection>
      ))}
    </div>
  );
}

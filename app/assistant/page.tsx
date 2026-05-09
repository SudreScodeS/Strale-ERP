'use client';

import { useState, useRef, useEffect } from 'react';
import { getAuthHeaders } from '../lib/authClient';
import { globalConfig } from '../../config/global';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  'Produto mais vendido',
  'Estoque baixo',
  'Lucro total',
  'Pedidos recentes',
  'Ticket medio',
  'Previsao de demanda',
  'Vendas por periodo',
  'Orcamentos pendentes',
  'Taxa de conversao',
  'Usuarios',
  'Despesas',
  'Resumo do sistema',
  'Quanto custa 500 sacolas TNT azuis?',
  'Preco de 1000 nylon 30x40 com serigrafia',
  'Como usar',
];

const PAGE_PATH = '/assistant';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'chat', visible: true, order: 0, colSpan: 2 },
  { id: 'suggestions', visible: true, order: 1, colSpan: 2 },
  { id: 'input', visible: true, order: 2, colSpan: 2 },
];

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
        return `<div key="${i}">${formatted}</div>`;
      })
      .join('');
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
          <div
            className="space-y-1 [&_strong]:font-semibold [&_em]:italic"
            dangerouslySetInnerHTML={{
              __html: formatContent(message.content)
                .replace(/<strong>/g, '<strong style="color:var(--text-primary)">')
                .replace(/<em>/g, '<em style="color:var(--text-muted)">'),
            }}
          />
        )}
        <p className={`mt-1.5 text-[10px] ${isUser ? 'opacity-50' : ''}`} style={isUser ? {} : { color: 'var(--text-faint)' }}>
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ola! Sou o assistente do **' + globalConfig.systemName + '**. Pergunte sobre vendas, estoque, financeiro ou previsao de demanda.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; model?: string; error?: string } | null>(null);
  const [lastSource, setLastSource] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  // Verifica status do Ollama ao carregar
  useEffect(() => {
    fetch('/api/assistant', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => setOllamaStatus(data))
      .catch(() => setOllamaStatus({ available: false, error: 'Erro ao verificar' }));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || 'Erro ao consultar assistente');
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, timestamp: new Date() }]);
      if (data.source) setLastSource(data.source);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Erro: ${error instanceof Error ? error.message : 'Nao foi possivel processar.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
            Assistente
          </h2>
          <div className="mt-0.5 flex items-center gap-2">
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
                title={ollamaStatus.error || (ollamaStatus.available ? `Modelo: ${ollamaStatus.model}` : 'Ollama nao detectado')}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ollamaStatus.available ? 'var(--success)' : 'var(--warning)' }} />
                {ollamaStatus.available
                  ? (ollamaStatus.error ? `IA: ${ollamaStatus.model || 'Ollama'} ⚠️` : `IA: ${ollamaStatus.model || 'Ollama'}`)
                  : 'IA: Local (pattern)'}
              </span>
            )}
            {ollamaStatus?.error && (
              <span className="text-[10px] max-w-xs truncate" style={{ color: 'var(--warning)' }} title={ollamaStatus.error}>
                {ollamaStatus.error}
              </span>
            )}
            {lastSource && (
              <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                via {lastSource}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() =>
            setMessages([
              { role: 'assistant', content: 'Chat limpo. Faca uma nova pergunta.', timestamp: new Date() },
            ])
          }
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          Limpar
        </button>
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
            <div
              className="flex-1 overflow-y-auto rounded-xl p-5"
              style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)', minHeight: '200px' }}
            >
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}

              {isLoading && (
                <div className="mb-3 flex justify-start">
                  <div className="rounded-xl px-4 py-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: 'var(--text-faint)', animationDelay: '0ms' }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: 'var(--text-faint)', animationDelay: '150ms' }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: 'var(--text-faint)', animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {section.id === 'suggestions' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s.toLowerCase())}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all"
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
                  {s}
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
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--brand)' }}
              >
                Enviar
              </button>
            </div>
          )}
        </DraggableSection>
      ))}
    </div>
  );
}

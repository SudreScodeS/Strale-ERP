'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getAuthHeaders } from '../lib/authClient';
import { globalConfig } from '../../config/global';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import { ErrorBoundary } from '../components/error-boundary';
import { ChatMessage, type ChatMessageType } from '../components/assistant/ChatMessage';
import { ToolExecution } from '../components/assistant/ToolExecution';
import { TypingIndicator } from '../components/assistant/TypingIndicator';
import { ChatInput } from '../components/assistant/ChatInput';
import { SuggestionChips } from '../components/assistant/SuggestionChips';
import { RichResponse } from '../components/assistant/RichResponse';
import { DataCard, DataCardGrid } from '../components/assistant/DataCard';
import { getContextualSuggestions, type Suggestion } from '../lib/ai/contextual-suggestions';

// ── Types ──────────────────────────────────────────────────────

interface OllamaStatus {
  available: boolean;
  model?: string;
  models?: string[];
  error?: string;
}

interface ToolExecutionState {
  tool: string;
  status: 'running' | 'success' | 'error';
  params?: Record<string, unknown>;
  result?: { success: boolean; message: string; data?: unknown };
}

// Extend ChatMessageType with structured data
interface ExtendedChatMessage extends ChatMessageType {
  structuredData?: unknown;
  richData?: Array<{ type: string; data: Record<string, unknown> }>;
}

const PAGE_PATH = '/assistant';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'chat', visible: true, order: 0, colSpan: 2 },
  { id: 'suggestions', visible: true, order: 1, colSpan: 2 },
  { id: 'input', visible: true, order: 2, colSpan: 2 },
];

// ── Main Page ──────────────────────────────────────────────────

export default function AssistantPage() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([
    {
      role: 'assistant',
      content: `Olá! Sou o assistente do **${globalConfig.systemName}**. Posso consultar vendas, estoque, financeiro, entregas, calcular preços e **executar ações** como criar orçamentos e produtos. Como posso ajudar?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolExecutionState[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Contextual suggestions based on current page
  const suggestions = getContextualSuggestions(pathname);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  // Check Ollama status
  useEffect(() => {
    fetch('/api/v1/assistant', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setOllamaStatus(data))
      .catch(() => setOllamaStatus({ available: false }));
  }, []);

  // Smart auto-scroll: only scroll if user is at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  const handleSend = useCallback(async (question?: string) => {
    const q = (question || input).trim();
    if (!q || isLoading) return;

    // Abort any previous request
    abortRef.current?.abort();

    setMessages((prev) => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    setInput('');
    setIsLoading(true);
    setActiveTools([]);

    // Add placeholder for streaming response
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/v1/assistant', {
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
      const actionResults: Array<{ success: boolean; message: string; tool: string }> = [];
      const richDataItems: Array<{ type: string; data: Record<string, unknown> }> = [];

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

            switch (event.type) {
              case 'token':
                if (event.chunk) fullContent += event.chunk;
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === 'assistant') {
                    next[next.length - 1] = { ...last, content: fullContent, isStreaming: true };
                  }
                  return next;
                });
                break;

              case 'tool_start':
                setActiveTools((prev) => [
                  ...prev,
                  { tool: event.tool, status: 'running', params: event.params },
                ]);
                break;

              case 'tool_result':
                setActiveTools((prev) =>
                  prev.map((t) =>
                    t.tool === event.tool
                      ? { ...t, status: event.result?.success ? 'success' : 'error', result: event.result }
                      : t,
                  ),
                );
                if (event.result) {
                  actionResults.push({ ...event.result, tool: event.tool });
                  // Collect structured data for rich rendering
                  if (event.result.data) {
                    richDataItems.push({ type: event.tool, data: event.result.data as Record<string, unknown> });
                  }
                }
                break;

              case 'done':
                source = event.source || source;
                toolsUsed = event.toolsUsed || toolsUsed;
                break;

              case 'error':
                fullContent += `\n\n${event.message}`;
                break;
            }
          } catch {
            // skip malformed
          }
        }
      }

      // Finalize message
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: fullContent,
            isStreaming: false,
            source: source || last.source,
            toolsUsed: toolsUsed.length > 0 ? toolsUsed : last.toolsUsed,
            actionResults: actionResults.length > 0 ? actionResults : undefined,
            richData: richDataItems.length > 0 ? richDataItems : undefined,
          };
        }
        return next;
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant' && !last.content) {
            next[next.length - 1] = {
              ...last,
              content: 'Geração interrompida.',
              isStreaming: false,
            };
          }
          return next;
        });
        return;
      }

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
      setActiveTools([]);
      abortRef.current = null;
    }
  }, [input, isLoading]);

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleClear() {
    abortRef.current?.abort();
    fetch('/api/v1/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ clear: true }),
    }).catch(() => {});
    setMessages([
      { role: 'assistant', content: 'Conversa limpa. Como posso ajudar?', timestamp: new Date() },
    ]);
    setActiveTools([]);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col animate-fade-in">
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
              Consultas e ações reais no sistema
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
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto rounded-xl p-5"
                style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)', minHeight: '200px' }}
              >
                {messages.map((msg, i) => (
                  <div key={i}>
                    <ChatMessage message={msg} />
                    {/* Rich data rendering for assistant messages */}
                    {msg.role === 'assistant' && msg.richData && msg.richData.length > 0 && (
                      <div className="ml-0 mb-3 max-w-[85%]">
                        {msg.richData.map((rd, ri) => {
                          // Detect if data is a list of items
                          const data = rd.data;
                          const arrayKey = Object.keys(data).find(k => Array.isArray(data[k]) && data[k].length > 0 && typeof data[k][0] === 'object');
                          if (arrayKey) {
                            const items = data[arrayKey] as Array<Record<string, unknown>>;
                            const cardType = rd.type.includes('order') ? 'order'
                              : rd.type.includes('quote') ? 'quote'
                              : rd.type.includes('product') ? 'product'
                              : rd.type.includes('supplier') ? 'supplier'
                              : rd.type.includes('user') ? 'user'
                              : 'generic';
                            return (
                              <div key={ri}>
                                <DataCardGrid type={cardType} items={items} />
                                <RichResponse data={data} compact />
                              </div>
                            );
                          }
                          return <RichResponse key={ri} data={data} compact />;
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator when loading and no content yet */}
                {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content && (
                  <TypingIndicator />
                )}

                {/* Active tool executions */}
                {activeTools.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {activeTools.map((tool, i) => (
                      <ToolExecution key={`${tool.tool}-${i}`} tool={tool.tool} status={tool.status} result={tool.result} />
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ErrorBoundary>
          )}

          {section.id === 'suggestions' && (
            <SuggestionChips
              suggestions={suggestions.map(s => ({ label: s.label, icon: s.icon }))}
              onSelect={(label) => {
                const suggestion = suggestions.find(s => s.label.toLowerCase() === label.toLowerCase());
                handleSend(suggestion?.query || label);
              }}
              disabled={isLoading}
            />
          )}

          {section.id === 'input' && (
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              onStop={handleStop}
              isLoading={isLoading}
            />
          )}
        </DraggableSection>
      ))}
    </div>
  );
}

// app/assistant/page.tsx
// Página do Assistente Inteligente Local
// Interface de chat que responde perguntas com dados reais do sistema
// Sem IA externa — pattern matching + consultas internas

'use client';

import { useState, useRef, useEffect } from 'react';
import { getAuthHeaders } from '../lib/authClient';
import { globalConfig } from '../../config/global';

// ==========================================
// TIPOS
// ==========================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'table' | 'metric' | 'list';
  icon?: string;
  timestamp: Date;
}

interface AssistantResponse {
  answer: string;
  data?: unknown;
  type: 'text' | 'table' | 'metric' | 'list';
  icon?: string;
}

// ==========================================
// SUGESTÕES DE PERGUNTAS
// ==========================================

const SUGGESTIONS = [
  { label: '📦 Produto mais vendido', query: 'produto mais vendido' },
  { label: '⚠️ Estoque baixo', query: 'estoque baixo' },
  { label: '💰 Lucro total', query: 'lucro total' },
  { label: '📋 Pedidos recentes', query: 'pedidos recentes' },
  { label: '📊 Ticket médio', query: 'ticket médio' },
  { label: '📈 Previsão de demanda', query: 'previsão de demanda' },
  { label: '🛡️ Fraudes detectadas', query: 'fraudes detectadas' },
  { label: '🏢 Resumo do sistema', query: 'resumo do sistema' },
  { label: '📅 Vendas por período', query: 'vendas por período' },
  { label: '👥 Usuários', query: 'usuários cadastrados' },
  { label: '💸 Despesas', query: 'despesas' },
  { label: '❓ Ajuda', query: 'ajuda' },
];

// ==========================================
// COMPONENTES
// ==========================================

/** Balão de mensagem do chat */
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-md'
            : 'rounded-bl-md shadow-sm'
        }`}
        style={
          isUser
            ? { background: 'var(--brand-blue)', color: '#ffffff' }
            : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }
        }
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div
            className="space-y-1 [&_strong]:font-semibold [&_em]:italic"
            style={{ '--chat-strong': 'var(--text-primary)', '--chat-em': 'var(--text-muted)' } as React.CSSProperties}
            dangerouslySetInnerHTML={{
              __html: formatContent(message.content)
                .replace(/<strong>/g, '<strong style="color:var(--text-primary)">')
                .replace(/<em>/g, '<em style="color:var(--text-muted)">'),
            }}
          />
        )}
        <p className={`mt-2 text-[10px] ${isUser ? 'opacity-60' : ''}`} style={isUser ? {} : { color: 'var(--text-faint)' }}>
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

/** Sugestões clicáveis */
function SuggestionChips({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s.query}
          onClick={() => onSelect(s.query)}
          className="rounded-full px-4 py-2 text-xs font-medium transition-all hover:shadow-sm"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--brand-blue)';
            e.currentTarget.style.color = 'var(--brand-blue)';
            e.currentTarget.style.background = 'var(--brand-blue-soft)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--card-border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--card-bg)';
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! 👋 Sou o assistente do **Simple ERP**. Pergunte qualquer coisa sobre vendas, estoque, financeiro, fraudes ou previsão de demanda.\n\nDigite sua pergunta ou clique em uma sugestão abaixo.',
      type: 'text',
      icon: '🤖',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus no input ao carregar
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || isLoading) return;

    // Adiciona mensagem do usuário
    const userMsg: ChatMessage = {
      role: 'user',
      content: q,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || 'Erro ao consultar assistente');
      }

      const data: AssistantResponse = await res.json();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.answer,
        type: data.type,
        icon: data.icon,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Erro: ${error instanceof Error ? error.message : 'Não foi possível processar sua pergunta.'}`,
        type: 'text',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
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

  function handleClear() {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat limpo! 🧹 Faça uma nova pergunta.',
        type: 'text',
        icon: '🤖',
        timestamp: new Date(),
      },
    ]);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* CABEÇALHO */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--brand-blue)' }}>
            {globalConfig.systemName}
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            🤖 Assistente
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Pergunte sobre vendas, estoque, financeiro, fraudes ou previsão. Respostas com dados reais.
          </p>
        </div>
        <button
          onClick={handleClear}
          className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          🧹 Limpar
        </button>
      </div>

      {/* ÁREA DE MENSAGENS */}
      <div
        className="flex-1 overflow-y-auto rounded-2xl p-6"
        style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}
      >
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {/* Indicador de digitação */}
        {isLoading && (
          <div className="mb-4 flex justify-start">
            <div
              className="rounded-2xl px-5 py-4 shadow-sm"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--text-faint)', animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--text-faint)', animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--text-faint)', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* SUGESTÕES (mostra apenas quando chat está vazio ou com poucas mensagens) */}
      {messages.length <= 2 && (
        <div className="mt-4">
          <SuggestionChips onSelect={(q) => handleSend(q)} />
        </div>
      )}

      {/* INPUT */}
      <div className="mt-4 flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua pergunta... (ex: 'produto mais vendido')"
          disabled={isLoading}
          className="flex-1 rounded-xl px-5 py-3 text-sm transition-all disabled:opacity-50"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--brand-blue)' }}
        >
          {isLoading ? '⏳' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

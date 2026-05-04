// app/assistant/page.tsx
// Página do Assistente Inteligente Local
// Interface de chat que responde perguntas com dados reais do sistema
// Sem IA externa — pattern matching + consultas internas

'use client';

import { useState, useRef, useEffect } from 'react';
import { getAuthHeaders } from '../lib/authClient';

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

  // Formata markdown simples: **bold** e listas com •
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // Bold
        let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic (underscores)
        formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
        return `<div key="${i}">${formatted}</div>`;
      })
      .join('');
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-3xl px-5 py-4 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-lg'
            : 'bg-white border border-slate-200 text-slate-800 shadow-sm rounded-bl-lg'
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div
            className="space-y-1 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_em]:italic [&_em]:text-slate-500"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />
        )}
        <p className={`mt-2 text-[10px] ${isUser ? 'text-blue-200' : 'text-slate-400'}`}>
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
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
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
          <p className="text-sm uppercase tracking-[0.3em] text-blue-700">ERP Modular</p>
          <h2 className="text-3xl font-semibold text-slate-900">🤖 Assistente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pergunte sobre vendas, estoque, financeiro, fraudes ou previsão. Respostas com dados reais.
          </p>
        </div>
        <button
          onClick={handleClear}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
        >
          🧹 Limpar chat
        </button>
      </div>

      {/* ÁREA DE MENSAGENS */}
      <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-6">
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {/* Indicador de digitação */}
        {isLoading && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
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
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '⏳' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

'use client';

// ── ChatMessage.tsx — Enhanced chat bubble with markdown support ─

import { useRef, useEffect } from 'react';

export interface ChatMessageType {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source?: string;
  toolsUsed?: string[];
  actionResults?: Array<{ success: boolean; message: string; tool: string }>;
  isStreaming?: boolean;
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    if (!line) return <div key={idx} className="h-2" />;

    // Headers
    if (line.startsWith('### ')) {
      return <h4 key={idx} className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>{line.slice(4)}</h4>;
    }
    if (line.startsWith('## ')) {
      return <h3 key={idx} className="text-base font-bold mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>{line.slice(3)}</h3>;
    }

    // Lists
    const listMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const content = listMatch[2];
      return (
        <div key={idx} className="flex gap-1.5" style={{ paddingLeft: `${indent * 8}px` }}>
          <span style={{ color: 'var(--brand)' }} className="mt-0.5">•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }

    // Numbered lists
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={idx} className="flex gap-1.5" style={{ paddingLeft: `${numMatch[1].length * 8}px` }}>
          <span style={{ color: 'var(--brand)' }} className="font-semibold">{numMatch[2]}.</span>
          <span>{renderInline(numMatch[3])}</span>
        </div>
      );
    }

    return <div key={idx}>{renderInline(line)}</div>;
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|_.*?_|`.*?`|\[.*?\]\(.*?\))/g).filter(Boolean);
  return parts.map((part, pi) => {
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
    // Links
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      return (
        <a key={pi} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="underline" style={{ color: 'var(--brand)' }}>
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message.isStreaming && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [message.content, message.isStreaming]);

  return (
    <div ref={ref} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
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
            {renderMarkdown(message.content)}
            {message.isStreaming && (
              <span className="inline-block h-3 w-1.5 animate-pulse" style={{ background: 'var(--brand)' }} />
            )}
          </div>
        )}

        {/* Action results */}
        {!isUser && message.actionResults && message.actionResults.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.actionResults.map((ar, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: ar.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                  border: `1px solid ${ar.success ? 'var(--success-border)' : 'var(--danger-border)'}`,
                  color: ar.success ? 'var(--success)' : 'var(--danger)',
                }}
              >
                <span className="flex-shrink-0">{ar.success ? true : false}</span>
                <span>{ar.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div
          className={`mt-1.5 flex items-center gap-2 text-[10px] ${isUser ? 'opacity-50' : ''}`}
          style={isUser ? {} : { color: 'var(--text-faint)' }}
        >
          <span>{message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          {!isUser && message.source && message.source !== 'pattern' && (
            <span
              className="rounded-full px-1.5 py-0.5"
              style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}
            >
              {message.source === 'cache' ? 'cache' : message.source === 'llm+tools' ? 'IA + dados' : 'IA'}
            </span>
          )}
          {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5"
              style={{ background: 'var(--info-bg)', color: 'var(--info)' }}
            >
              {message.toolsUsed.length} ação{message.toolsUsed.length > 1 ? 'ões' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

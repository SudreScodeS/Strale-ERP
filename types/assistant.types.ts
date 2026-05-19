// types/assistant.types.ts
// AI assistant domain: chat messages and status types.

/** Chat message in the assistant UI */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source?: string;
  toolsUsed?: string[];
  isStreaming?: boolean;
}

/** Ollama service status */
export interface OllamaStatus {
  available: boolean;
  model?: string;
  models?: string[];
  error?: string;
}

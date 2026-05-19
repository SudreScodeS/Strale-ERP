// lib/ai/memory.ts
// In-memory conversation store per user session.
// Keeps recent messages for context; auto-expires old sessions.

interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Session {
  messages: ConversationEntry[];
  lastAccess: number;
}

const sessions = new Map<string, Session>();

// Config
const MAX_MESSAGES_PER_SESSION = 20;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastAccess > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

function getSession(userId: string): Session {
  let session = sessions.get(userId);
  if (!session) {
    session = { messages: [], lastAccess: Date.now() };
    sessions.set(userId, session);
  }
  session.lastAccess = Date.now();
  return session;
}

/**
 * Add a message to the user's conversation history.
 */
export function addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
  const session = getSession(userId);
  session.messages.push({ role, content, timestamp: Date.now() });

  // Trim old messages
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
  }
}

/**
 * Get recent conversation history for context.
 */
export function getHistory(userId: string, limit = 10): ConversationEntry[] {
  const session = getSession(userId);
  return session.messages.slice(-limit);
}

/**
 * Clear conversation history for a user.
 */
export function clearHistory(userId: string): void {
  sessions.delete(userId);
}

/**
 * Get all messages as chat format for the LLM.
 */
export function getChatMessages(userId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  return getHistory(userId).map((m) => ({ role: m.role, content: m.content }));
}

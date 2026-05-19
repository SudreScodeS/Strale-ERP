import crypto from 'crypto';
const tokens = new Map<string, number>(); // token → expiry timestamp
const CSRF_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Cleanup expired every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of tokens) {
    if (now > expiry) tokens.delete(token);
  }
}, 10 * 60 * 1000);

export function generateCsrfToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + CSRF_EXPIRY_MS);
  return token;
}

export function validateCsrfToken(token: string): boolean {
  if (!token) return false;
  const expiry = tokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) { tokens.delete(token); return false; }
  tokens.delete(token); // one-time use
  return true;
}

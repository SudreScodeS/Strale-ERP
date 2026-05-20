// File-based refresh token store — persists across server restarts
import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), 'data', 'refresh-tokens.json');

interface TokenEntry {
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
  family: string;
}

function readStore(): Record<string, TokenEntry> {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, TokenEntry>): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function storeToken(token: string, userId: string, expiresAt: number, family: string): void {
  const store = readStore();
  store[token] = { token, userId, expiresAt, createdAt: Date.now(), family };
  const now = Date.now();
  for (const [key, entry] of Object.entries(store)) {
    if (now > entry.expiresAt) delete store[key];
  }
  writeStore(store);
}

export function getToken(token: string): TokenEntry | null {
  const store = readStore();
  const entry = store[token];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete store[token];
    writeStore(store);
    return null;
  }
  return entry;
}

export function deleteToken(token: string): void {
  const store = readStore();
  delete store[token];
  writeStore(store);
}

export function deleteTokensByUserId(userId: string): void {
  const store = readStore();
  for (const [key, entry] of Object.entries(store)) {
    if (entry.userId === userId) delete store[key];
  }
  writeStore(store);
}

export function deleteTokensByFamily(family: string): void {
  const store = readStore();
  for (const [key, entry] of Object.entries(store)) {
    if (entry.family === family) delete store[key];
  }
  writeStore(store);
}

export function cleanupExpired(): number {
  const store = readStore();
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of Object.entries(store)) {
    if (now > entry.expiresAt) { delete store[key]; cleaned++; }
  }
  if (cleaned > 0) writeStore(store);
  return cleaned;
}

import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'data', 'security-logs.json');
const MAX_ENTRIES = 1000;

interface SecurityLogEntry {
  timestamp: string;
  type: string;
  details: string;
  ip?: string;
  path?: string;
  username?: string;
  userId?: string;
}

function readLogs(): SecurityLogEntry[] {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function appendLog(entry: SecurityLogEntry): void {
  const logs = readLogs();
  logs.push(entry);
  // Keep only the last MAX_ENTRIES
  while (logs.length > MAX_ENTRIES) logs.shift();
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

export function logLoginAttempt(username: string, success: boolean, ip: string, reason?: string): void {
  appendLog({
    timestamp: new Date().toISOString(),
    type: success ? 'login_success' : 'login_failed',
    details: success
      ? `Login bem-sucedido para "${username}"`
      : `Login falhou para "${username}"${reason ? `: ${reason}` : ''}`,
    ip,
    username,
  });
  console.warn(`[SECURITY] ${success ? 'LOGIN_OK' : 'LOGIN_FAIL'}: ${username} from ${ip}${reason ? ` — ${reason}` : ''}`);
}

export function logTokenRefresh(userId: string, ip: string): void {
  appendLog({
    timestamp: new Date().toISOString(),
    type: 'token_refresh',
    details: `Refresh token rotacionado para userId="${userId}"`,
    ip,
    userId,
  });
}

export function logRateLimitHit(ip: string, requestPath: string): void {
  appendLog({
    timestamp: new Date().toISOString(),
    type: 'rate_limit_exceeded',
    details: `Rate limit excedido de ${ip} em ${requestPath}`,
    ip,
    path: requestPath,
  });
  console.warn(`[SECURITY] RATE_LIMIT: ${ip} on ${requestPath}`);
}

export function logSuspiciousActivity(description: string, ip: string, details?: Record<string, unknown>): void {
  appendLog({
    timestamp: new Date().toISOString(),
    type: 'suspicious_activity',
    details: `${description}${details ? ` | ${JSON.stringify(details)}` : ''}`,
    ip,
  });
  console.warn(`[SECURITY] SUSPICIOUS: ${description} from ${ip}`);
}

export function getSecurityLogs(limit = 50): SecurityLogEntry[] {
  return readLogs().slice(-limit);
}

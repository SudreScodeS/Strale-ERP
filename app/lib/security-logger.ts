type SecurityEvent = {
  timestamp: string;
  type: 'failed_login' | 'rate_limit_exceeded' | 'csrf_failure' | 'unauthorized_access' | 'suspicious_request';
  details: string;
  ip?: string;
  path?: string;
};

const buffer: SecurityEvent[] = [];
const MAX_BUFFER = 1000;

export function logSecurityEvent(type: SecurityEvent['type'], details: string, ip?: string, path?: string): void {
  const event: SecurityEvent = { timestamp: new Date().toISOString(), type, details, ip, path };
  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  console.warn(`[SECURITY] ${event.type}: ${event.details}`, ip ? `IP=${ip}` : '', path ? `path=${path}` : '');
}

export function getSecurityEvents(limit = 50): SecurityEvent[] {
  return buffer.slice(-limit);
}

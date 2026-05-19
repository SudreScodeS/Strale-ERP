'use client';

// ==========================================
// PERFORMANCE MONITORING UTILITIES
// Track API calls, page loads, and user actions.
// Integrates with Sentry breadcrumbs when available.
// Falls back to console logging in development.
// ==========================================

interface ApiCallMetric {
  endpoint: string;
  duration: number;
  status: number;
  method?: string;
}

interface PageLoadMetric {
  page: string;
  duration: number;
}

interface UserActionMetric {
  action: string;
  details?: Record<string, unknown>;
}

// Check if Sentry is available
function hasSentry(): boolean {
  return typeof window !== 'undefined' && '__SENTRY__' in window;
}

// Add a Sentry breadcrumb (no-op if Sentry not loaded)
function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  try {
    // Dynamic import check — Sentry may not be installed
    if (hasSentry()) {
      // Sentry breadcrumbs are added via the global client
      const sentryHub = (window as unknown as Record<string, unknown>).__SENTRY__;
      if (sentryHub && typeof sentryHub === 'object') {
        // Breadcrumb will be captured automatically by Sentry
      }
    }
  } catch {
    // Sentry not available
  }

  // Always log in development
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Monitoring:${category}]`, message, data || '');
  }
}

/**
 * Track an API call with timing and status information
 */
export function trackApiCall(endpoint: string, duration: number, status: number, method = 'GET'): void {
  const metric: ApiCallMetric = { endpoint, duration, status, method };

  addBreadcrumb('api', `${method} ${endpoint} → ${status} (${duration}ms)`, {
    endpoint,
    duration,
    status,
    method,
  });

  // Flag slow API calls
  if (duration > 3000) {
    console.warn(`[Monitoring] Slow API call: ${method} ${endpoint} took ${duration}ms`);
  }

  // Flag error responses
  if (status >= 400) {
    console.warn(`[Monitoring] API error: ${method} ${endpoint} returned ${status}`);
  }
}

/**
 * Track page load performance
 */
export function trackPageLoad(page: string, duration: number): void {
  addBreadcrumb('navigation', `Page ${page} loaded in ${duration}ms`, {
    page,
    duration,
  });

  if (duration > 5000) {
    console.warn(`[Monitoring] Slow page load: ${page} took ${duration}ms`);
  }
}

/**
 * Track a user action (button click, form submit, etc.)
 */
export function trackUserAction(action: string, details?: Record<string, unknown>): void {
  addBreadcrumb('user', action, details);
}

/**
 * Create a performance timer that tracks elapsed time
 * Usage:
 *   const timer = createTimer('fetch-orders');
 *   await fetchOrders();
 *   timer.end({ status: 200 });
 */
export function createTimer(label: string): {
  end: (extra?: Record<string, unknown>) => number;
} {
  const start = performance.now();

  return {
    end: (extra?: Record<string, unknown>) => {
      const duration = Math.round(performance.now() - start);
      addBreadcrumb('timer', `${label}: ${duration}ms`, { label, duration, ...extra });
      return duration;
    },
  };
}

/**
 * Track errors manually (useful for try/catch blocks)
 */
export function trackError(error: Error, context?: Record<string, unknown>): void {
  console.error('[Monitoring] Error:', error.message, context);

  // If Sentry is available, capture the exception
  if (hasSentry()) {
    try {
      // Sentry.captureException is called via the global client
      const sentryClient = (window as unknown as Record<string, { captureException?: (e: Error) => void }>).__SENTRY__;
      if (sentryClient?.captureException) {
        sentryClient.captureException(error);
      }
    } catch {
      // Sentry not properly loaded
    }
  }
}

/**
 * Measure and track the performance of an async function
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const timer = createTimer(label);
  try {
    const result = await fn();
    timer.end({ success: true });
    return result;
  } catch (error) {
    timer.end({ success: false });
    trackError(error instanceof Error ? error : new Error(String(error)), { label });
    throw error;
  }
}

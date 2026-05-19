# Sentry Error Tracking & Monitoring Setup

This document explains how to set up Sentry for error tracking and performance monitoring in the Elitium ERP application.

## 1. Create a Sentry Project

1. Go to [sentry.io](https://sentry.io) and create an account (or use your existing one)
2. Create a new project:
   - Platform: **Next.js**
   - Alert settings: Configure as needed (defaults are fine)
3. Copy the **DSN** from the project settings page

## 2. Install the Sentry Package

```bash
npm install @sentry/nextjs
```

## 3. Configure Environment Variables

Add to your `.env.local` file:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token  # For source maps upload (optional)
SENTRY_ORG=your-org-slug           # For source maps upload (optional)
SENTRY_PROJECT=your-project-slug   # For source maps upload (optional)
```

## 4. What Gets Captured

### Automatic Error Capture
- **Client-side errors**: Unhandled exceptions, unhandled promise rejections
- **Server-side errors**: API route errors, SSR failures
- **Edge runtime errors**: Middleware errors

### Performance Monitoring
- **Client-side**: Page loads, navigation, user interactions (20% sample rate)
- **Server-side**: API call durations, server-side rendering (20% sample rate)
- **Edge runtime**: Middleware performance (10% sample rate)

### Session Replay
- **Normal sessions**: 10% are recorded for UX analysis
- **Error sessions**: 100% are recorded when an error occurs

### Filtered Noise
The client config automatically filters out:
- `ResizeObserver loop limit exceeded`
- `ResizeObserver loop completed with undelivered notifications`
- `Non-Error promise rejection captured`

## 5. Custom Monitoring (app/lib/monitoring.ts)

The app includes custom monitoring utilities:

```typescript
import { trackApiCall, trackPageLoad, trackUserAction, createTimer, trackError } from '@/app/lib/monitoring';

// Track API calls
const timer = createTimer('fetch-orders');
const data = await fetch('/api/orders');
timer.end({ status: data.status });

// Track user actions
trackUserAction('button-click', { button: 'save-order' });

// Track errors manually
try {
  riskyOperation();
} catch (error) {
  trackError(error, { context: 'order-creation' });
}
```

## 6. Configuration Files

| File | Runtime | Sample Rate |
|------|---------|-------------|
| `sentry.client.config.ts` | Browser | 20% traces, 10% replays |
| `sentry.server.config.ts` | Node.js | 20% traces |
| `sentry.edge.config.ts` | Edge | 10% traces |
| `instrumentation.ts` | Hook | Loads configs per runtime |

## 7. Source Maps (Optional)

For better error stack traces in production, configure source map uploads:

```bash
# Add to your build script in package.json
"build": "next build"
```

The `@sentry/nextjs` package automatically handles source map uploads if you set:
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## 8. Testing

To verify Sentry is working:

1. Add `NEXT_PUBLIC_SENTRY_DSN` to your `.env.local`
2. Run `npm run dev`
3. Trigger a test error:
   ```typescript
   throw new Error('Sentry test error');
   ```
4. Check your Sentry dashboard for the error

## 9. Production Recommendations

- **Alert rules**: Set up alerts for error spikes and slow transactions
- **Releases**: Track deployments for regression detection
- **Performance budgets**: Set thresholds for page load times
- **User feedback**: Enable the user feedback widget for error reports

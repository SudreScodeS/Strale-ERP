import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 20% of transactions for performance monitoring
  tracesSampleRate: 0.2,

  environment: process.env.NODE_ENV,

  // Server-side: capture all unhandled rejections
  integrations: [
    // Default integrations are included automatically
  ],
});

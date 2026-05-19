import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Edge runtime: lower sample rate (runs on every request)
  tracesSampleRate: 0.1,

  environment: process.env.NODE_ENV,
});

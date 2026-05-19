// api/v1/logo-analysis/route.ts
// V1 standardized logo analysis endpoint.
// Delegates to the existing implementation — business logic is too complex to duplicate.

import { POST as originalPOST } from '../../logo-analysis/route';

export async function POST(request: Request) {
  return originalPOST(request);
}

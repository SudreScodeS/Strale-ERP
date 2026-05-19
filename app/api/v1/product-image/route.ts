// api/v1/product-image/route.ts
// V1 standardized product image endpoint.
// Delegates to the existing implementation — business logic is too complex to duplicate.

import { POST as originalPOST } from '../../product-image/route';

export async function POST(request: Request) {
  return originalPOST(request);
}

// types/auth.types.ts
// Authentication and authorization types.

/** JWT token payload structure */
export interface TokenPayload {
  id: string;
  username: string;
  role: 'admin' | 'seller';
  exp?: number;
}

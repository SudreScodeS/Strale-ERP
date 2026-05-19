// types/api.types.ts
// Standardized API response envelope for all v1 endpoints.

/** Successful API response */
export interface ApiSuccess<T = unknown> {
  success: true;
  message?: string;
  data: T;
  meta?: ApiMeta;
}

/** Error API response */
export interface ApiError {
  success: false;
  message: string;
  errorCode?: string;
  details?: Record<string, string[]>;
}

/** Pagination / metadata */
export interface ApiMeta {
  timestamp: string;
  requestId?: string;
  page?: number;
  pageSize?: number;
  total?: number;
}

/** Union type for all API responses */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

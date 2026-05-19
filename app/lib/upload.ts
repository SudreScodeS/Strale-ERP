// ==========================================
// UPLOAD MANAGER
// Abstraction layer for file uploads
// Supports multiple backends: local, S3, R2
// ==========================================

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface UploadConfig {
  maxSizeBytes: number;
  allowedTypes: string[];
  backend: 'local' | 's3' | 'r2';
}

// Default configuration: max 5MB, images only
export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  backend: 'local',
};

/**
 * Validate a file against upload configuration
 * Returns an error message or null if valid
 */
export function validateFile(file: File, config: UploadConfig = DEFAULT_UPLOAD_CONFIG): string | null {
  if (file.size > config.maxSizeBytes) {
    const maxMB = (config.maxSizeBytes / (1024 * 1024)).toFixed(0);
    return `Arquivo muito grande. Tamanho máximo: ${maxMB}MB`;
  }

  if (!config.allowedTypes.includes(file.type)) {
    const extensions = config.allowedTypes
      .map(t => t.split('/')[1]?.toUpperCase())
      .filter(Boolean)
      .join(', ');
    return `Tipo de arquivo não permitido. Aceitos: ${extensions}`;
  }

  return null;
}

/**
 * Upload a file to the server via the API endpoint
 * Uses the /api/v1/upload endpoint
 */
export async function uploadFile(
  file: File,
  config: UploadConfig = DEFAULT_UPLOAD_CONFIG,
): Promise<UploadResult> {
  // Validate before uploading
  const validationError = validateFile(file, config);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/upload', {
    method: 'POST',
    body: formData,
    // Don't set Content-Type — browser sets it with boundary for FormData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed with status ${response.status}`);
  }

  const result: UploadResult = await response.json();
  return result;
}

/**
 * Delete a file by key via the API
 */
export async function deleteFile(key: string): Promise<void> {
  const response = await fetch(`/api/v1/upload?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Delete failed with status ${response.status}`);
  }
}

/**
 * Get a presigned URL for direct access (useful for S3/R2)
 * For local storage, returns the public URL directly
 */
export async function getPresignedUrl(key: string): Promise<string> {
  const response = await fetch(`/api/v1/upload/presign?key=${encodeURIComponent(key)}`);

  if (!response.ok) {
    // Fallback: assume local storage, return public URL
    return `/uploads/${key}`;
  }

  const data = await response.json();
  return data.url;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

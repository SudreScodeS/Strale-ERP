'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { validateFile, uploadFile, formatFileSize, DEFAULT_UPLOAD_CONFIG, type UploadResult, type UploadConfig } from '../lib/upload';

// ==========================================
// FILE UPLOAD COMPONENT
// Drag & drop + file picker with preview
// ==========================================

interface FileUploadProps {
  /** Called when upload completes successfully */
  onUpload?: (result: UploadResult) => void;
  /** Called when upload fails */
  onError?: (error: string) => void;
  /** Called when file is removed */
  onRemove?: () => void;
  /** Current value (URL of already uploaded file) */
  value?: string;
  /** Custom upload configuration */
  config?: UploadConfig;
  /** Label text */
  label?: string;
  /** Accept attribute for file input */
  accept?: string;
  /** Disable the component */
  disabled?: boolean;
  /** Compact mode (smaller size) */
  compact?: boolean;
}

export function FileUpload({
  onUpload,
  onError,
  onRemove,
  value,
  config = DEFAULT_UPLOAD_CONFIG,
  label = 'Arraste uma imagem aqui ou clique para selecionar',
  accept = 'image/*',
  disabled = false,
  compact = false,
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external value
  useEffect(() => {
    if (value !== undefined) setPreview(value || null);
  }, [value]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    // Validate
    const validationError = validateFile(file, config);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }

    // Generate local preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    setProgress(0);

    // Simulate progress (since fetch doesn't provide upload progress easily)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const result = await uploadFile(file, config);
      setProgress(100);
      setPreview(result.url);
      onUpload?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar arquivo';
      setError(message);
      onError?.(message);
      setPreview(null);
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }, [config, onUpload, onError]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [disabled, handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    setError(null);
    onRemove?.();
  }, [onRemove]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  const maxMB = (config.maxSizeBytes / (1024 * 1024)).toFixed(0);
  const acceptedTypes = config.allowedTypes
    .map(t => `.${t.split('/')[1]}`)
    .join(',');

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
          compact ? 'p-4' : 'p-8'
        } ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
        style={{
          borderColor: dragActive
            ? 'var(--brand)'
            : error
              ? 'var(--danger, #ef4444)'
              : 'var(--border)',
          background: dragActive
            ? 'var(--brand-muted)'
            : error
              ? 'var(--danger-bg, #fef2f2)'
              : 'var(--surface-muted)',
          minHeight: compact ? '80px' : '160px',
        }}
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={accept || acceptedTypes}
          onChange={handleChange}
          className="sr-only"
          disabled={disabled}
          aria-hidden="true"
        />

        {preview ? (
          /* Preview */
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className={`${compact ? 'h-16 w-16' : 'h-32 w-32'} rounded-lg object-cover`}
            />
            {!uploading && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-110"
                aria-label="Remover imagem"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          /* Placeholder */
          <>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: 'var(--brand-muted)',
                color: 'var(--brand)',
              }}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p
              className={`mt-3 text-center text-sm font-medium ${compact ? 'text-xs' : ''}`}
              style={{ color: 'var(--text-secondary)' }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: 'var(--text-faint)' }}
            >
              Máximo {maxMB}MB · {config.allowedTypes.map(t => t.split('/')[1]?.toUpperCase()).join(', ')}
            </p>
          </>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: 'var(--brand)',
                }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-white">
              Enviando... {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p
          className="mt-2 text-xs font-medium"
          style={{ color: 'var(--danger, #ef4444)' }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

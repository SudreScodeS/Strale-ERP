'use client';

// ==========================================
// SKELETON LOADING COMPONENTS
// ==========================================
// Animated placeholder components that match the layout of real content.
// Prevents layout shift and gives users a sense of what's loading.

/** Base skeleton pulse animation wrapper */
function SkeletonPulse({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ background: 'var(--surface-muted, #e2e8f0)', ...style }}
    />
  );
}

/** Single text line skeleton */
export function SkeletonText({ width = '100%', height = '0.75rem', className = '' }: { width?: string; height?: string; className?: string }) {
  return <SkeletonPulse className={className} style={{ width, height, borderRadius: '0.375rem' }} />;
}

/** Card skeleton — matches MetricCard layout */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--card-border, #e2e8f0)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <SkeletonText width="60%" height="0.625rem" />
          <SkeletonText width="45%" height="1.75rem" />
          <SkeletonText width="35%" height="0.5rem" />
        </div>
        <SkeletonPulse className="h-10 w-10 flex-shrink-0 rounded-xl" />
      </div>
    </div>
  );
}

/** Table row skeleton */
export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-3" style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonText
          key={i}
          width={i === 0 ? '30%' : i === columns - 1 ? '15%' : '20%'}
          height="0.875rem"
        />
      ))}
    </div>
  );
}

/** Table skeleton with header */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--card-border, #e2e8f0)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 pb-3" style={{ borderBottom: '2px solid var(--border, #e2e8f0)' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonPulse
            key={i}
            style={{ width: i === 0 ? '30%' : '20%', height: '0.75rem', borderRadius: '0.25rem' }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
  );
}

/** Dashboard metrics skeleton (4 cards grid) */
export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Product list skeleton */
export function SkeletonProductList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-5"
          style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--card-border, #e2e8f0)' }}
        >
          <div className="flex items-center gap-4">
            <SkeletonPulse className="h-14 w-14 flex-shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <SkeletonText width="40%" height="1rem" />
              <SkeletonText width="60%" height="0.625rem" />
              <div className="flex gap-3">
                <SkeletonText width="15%" height="0.5rem" />
                <SkeletonText width="10%" height="0.5rem" />
                <SkeletonText width="15%" height="0.5rem" />
              </div>
            </div>
            <div className="flex gap-2">
              <SkeletonPulse className="h-8 w-16 rounded-lg" />
              <SkeletonPulse className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Order list skeleton */
export function SkeletonOrderList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-5"
          style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--card-border, #e2e8f0)' }}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <SkeletonText width="180px" height="0.875rem" />
              <SkeletonText width="120px" height="0.625rem" />
              <SkeletonText width="100px" height="0.625rem" />
              <SkeletonText width="80px" height="0.625rem" />
            </div>
            <div className="flex gap-2">
              <SkeletonPulse className="h-8 w-20 rounded-lg" />
              <SkeletonPulse className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Form skeleton */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <SkeletonText width="30%" height="0.75rem" />
          <SkeletonPulse style={{ width: '100%', height: '2.625rem', borderRadius: '0.75rem' }} />
        </div>
      ))}
      <SkeletonPulse style={{ width: '140px', height: '2.5rem', borderRadius: '0.5rem' }} />
    </div>
  );
}

/** Generic loading spinner (replaces inline spinners) */
export function LoadingSpinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizeMap[size]} animate-spin rounded-full border-2 border-t-transparent`}
        style={{ borderColor: 'var(--border)', borderTopColor: 'transparent' }}
      />
      {label && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
      )}
    </div>
  );
}

/** Full page loading state (replaces the dashboard spinner) */
export function SkeletonPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <SkeletonText width="120px" height="0.625rem" />
        <SkeletonText width="220px" height="1.75rem" />
      </div>
      {/* Content skeleton */}
      <SkeletonMetrics />
      <SkeletonTable rows={5} columns={4} />
    </div>
  );
}

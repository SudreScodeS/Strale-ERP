'use client';

// ── DataCard.tsx — Card component for displaying structured data in chat ─

import { StatusBadge, fmtCurrency } from './RichResponse';

interface DataCardProps {
  type: 'order' | 'product' | 'quote' | 'supplier' | 'user' | 'generic';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  onClick?: () => void;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  order: { icon: '🛒', label: 'Pedido', color: 'var(--info)' },
  product: { icon: '📦', label: 'Produto', color: 'var(--success)' },
  quote: { icon: '📋', label: 'Orçamento', color: 'var(--warning)' },
  supplier: { icon: '🏭', label: 'Fornecedor', color: 'var(--brand)' },
  user: { icon: '👤', label: 'Usuário', color: 'var(--brand)' },
  generic: { icon: '📄', label: 'Item', color: 'var(--text-muted)' },
};

function OrderCard({ data }: { data: Record<string, any> }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {String(data.name || data.id || 'Pedido')}
          </p>
          {(typeof data.customerName === "string" ? data.customerName : null) && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Cliente: {String(data.customerName)}
            </p>
          )}
        </div>
        {data.status && typeof data.status === 'string' && <StatusBadge status={data.status} />}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {data.totalPrice !== undefined && (
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand)' }}>
            {typeof data.totalPrice === 'number' ? fmtCurrency(data.totalPrice) : String(data.totalPrice)}
          </span>
        )}
        {data.delivered !== undefined && (
          <span className="text-[10px]" style={{ color: data.delivered ? 'var(--success)' : 'var(--warning)' }}>
            {data.delivered ? '✅ Entregue' : '⏳ Pendente'}
          </span>
        )}
      </div>
      {data.createdAt && (
        <p className="mt-1 text-[10px]" style={{ color: 'var(--text-faint)' }}>
          {String(data.createdAt)}
        </p>
      )}
    </>
  );
}

function ProductCard({ data }: { data: Record<string, any> }) {
  const stock = typeof data.totalStock === 'number' ? data.totalStock : undefined;
  const stockColor = stock !== undefined ? (stock < 10 ? 'var(--danger)' : stock < 30 ? 'var(--warning)' : 'var(--success)') : 'var(--text-muted)';

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {String(data.name || 'Produto')}
          </p>
          {(typeof data.description === "string" ? data.description : null) && (
            <p className="text-[11px] line-clamp-1" style={{ color: 'var(--text-muted)' }}>
              {String(data.description)}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {data.basePrice !== undefined && (
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand)' }}>
            {typeof data.basePrice === 'number' ? fmtCurrency(data.basePrice) : String(data.basePrice)}
          </span>
        )}
        {stock !== undefined && (
          <span className="text-[11px] font-medium" style={{ color: stockColor }}>
            Estoque: {stock}
          </span>
        )}
        {data.groups !== undefined && (
          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {String(data.groups)} grupos · {String(data.variables)} vars
          </span>
        )}
      </div>
      {stock !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min((stock / 100) * 100, 100)}%`, background: stockColor }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function QuoteCard({ data }: { data: Record<string, any> }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {String(data.name || data.customerName || 'Orçamento')}
          </p>
          {data.customerName && data.name && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Cliente: {String(data.customerName)}
            </p>
          )}
        </div>
        {data.status && typeof data.status === 'string' && <StatusBadge status={data.status} />}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {data.totalPrice !== undefined && (
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand)' }}>
            {typeof data.totalPrice === 'number' ? fmtCurrency(data.totalPrice) : String(data.totalPrice)}
          </span>
        )}
        {data.validUntil && (
          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            Válido até: {String(data.validUntil)}
          </span>
        )}
      </div>
    </>
  );
}

function SupplierCard({ data }: { data: Record<string, any> }) {
  return (
    <>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {String(data.name || 'Fornecedor')}
      </p>
      {(typeof data.contact === "string" ? data.contact : null) && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          📞 {String(data.contact)}
        </p>
      )}
      {(typeof data.notes === "string" ? data.notes : null) && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {String(data.notes)}
        </p>
      )}
    </>
  );
}

function UserCard({ data }: { data: Record<string, any> }) {
  const username = String(data.username || 'Usuário');
  return (
    <>
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: 'var(--brand)', color: '#fff' }}
        >
          {username[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{username}</p>
          {(typeof data.role === "string" ? data.role : null) && (
            <p className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{String(data.role)}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {data.orderCount !== undefined && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {String(data.orderCount)} pedidos
          </span>
        )}
        {data.totalSales !== undefined && (
          <span className="text-[11px] font-medium" style={{ color: 'var(--brand)' }}>
            {String(data.totalSales)}
          </span>
        )}
      </div>
    </>
  );
}

function GenericCard({ data }: { data: Record<string, any> }) {
  const displayKeys = Object.entries(data).filter(([, v]) =>
    v !== null && v !== undefined && typeof v !== 'object'
  ).slice(0, 6);

  return (
    <>
      {displayKeys.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
          </span>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
            {String(value)}
          </span>
        </div>
      ))}
    </>
  );
}

const CARD_RENDERERS: Record<string, React.FC<{ data: Record<string, any> }>> = {
  order: OrderCard,
  product: ProductCard,
  quote: QuoteCard,
  supplier: SupplierCard,
  user: UserCard,
  generic: GenericCard,
};

export function DataCard({ type, data, onClick }: DataCardProps) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.generic;
  const Renderer = CARD_RENDERERS[type] || CARD_RENDERERS.generic;

  return (
    <div
      className="rounded-xl p-3 transition-all"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = config.color;
          e.currentTarget.style.boxShadow = `0 2px 8px ${config.color}22`;
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--card-border)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-xs">{config.icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>
      <Renderer data={data} />
    </div>
  );
}

// ── DataCardGrid — renders multiple cards ────────────────────

export function DataCardGrid({
  type,
  items,
  maxItems = 6,
}: {
  type: DataCardProps['type'];
  items: Array<Record<string, any>>;
  maxItems?: number;
}) {
  if (items.length === 0) return null;

  const shown = items.slice(0, maxItems);

  return (
    <div className="mt-2 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((item, i) => (
          <DataCard key={i} type={type} data={item} />
        ))}
      </div>
      {items.length > maxItems && (
        <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
          + {items.length - maxItems} mais itens
        </p>
      )}
    </div>
  );
}

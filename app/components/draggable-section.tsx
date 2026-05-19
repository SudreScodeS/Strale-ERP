'use client';

import { useRef, useState, type ReactNode, type DragEvent } from 'react';
import { useLayout, type SectionConfig } from './layout-context';
import { ErrorBoundary } from './error-boundary';

interface DraggableSectionProps {
  pagePath: string;
  section: SectionConfig;
  index: number;
  totalSections: number;
  children: ReactNode;
  className?: string;
}

export function DraggableSection({
  pagePath,
  section,
  index,
  totalSections,
  children,
  className = '',
}: DraggableSectionProps) {
  const { isEditing, updateSection, reorderSections } = useLayout();
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  if (!section.visible && !isEditing) return null;

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setIsDragging(true);
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== index) {
      reorderSections(pagePath, fromIndex, index);
    }
  }

  const colSpanClass = section.colSpan === 2 ? 'md:col-span-2' : '';

  return (
    <div
      ref={dragRef}
      draggable={isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative transition-all duration-200 ${colSpanClass} ${className} ${
        isDragging ? 'opacity-40 scale-[0.98]' : ''
      } ${isDragOver ? 'ring-2 ring-blue-400 ring-offset-2 rounded-3xl' : ''} ${
        !section.visible && isEditing ? 'opacity-30' : ''
      }`}
    >
      {/* Edit overlay */}
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1.5 rounded-xl bg-white px-2 py-1.5 shadow-lg border border-slate-200"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Drag handle */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing rounded-lg p-1 transition-colors hover:bg-slate-100"
            style={{ color: 'var(--text-muted)' }}
            title="Arrastar para reordenar"
            onMouseDown={(e) => {
              // Let the parent draggable handle it
              e.stopPropagation();
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </button>

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={() => updateSection(pagePath, section.id, { visible: !section.visible })}
            className={`rounded-lg p-1 transition-colors ${
              section.visible ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
            }`}
            title={section.visible ? 'Ocultar seção' : 'Mostrar seção'}
          >
            {section.visible ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            )}
          </button>

          {/* Resize toggle */}
          <button
            type="button"
            onClick={() =>
              updateSection(pagePath, section.id, { colSpan: section.colSpan === 1 ? 2 : 1 })
            }
            className="rounded-lg p-1 text-[var(--brand)] transition-colors hover:bg-[var(--brand-muted)]"
            title={section.colSpan === 1 ? 'Expandir para largura total' : 'Reduzir para metade'}
          >
            {section.colSpan === 1 ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            )}
          </button>

          {/* Move left */}
          <button
            type="button"
            disabled={index === 0}
            onClick={() => reorderSections(pagePath, index, index - 1)}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
            title="Mover para esquerda"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Move right */}
          <button
            type="button"
            disabled={index === totalSections - 1}
            onClick={() => reorderSections(pagePath, index, index + 1)}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
            title="Mover para direita"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* Section content — wrapped in ErrorBoundary for isolation */}
      <ErrorBoundary name={section.id}>
        {children}
      </ErrorBoundary>
    </div>
  );
}

// ==========================================
// EDIT MODE TOOLBAR
// ==========================================

export function LayoutToolbar({ pagePath }: { pagePath: string }) {
  const { isEditing, setIsEditing, resetPageLayout } = useLayout();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsEditing(!isEditing)}
        className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-all ${
          isEditing
            ? 'bg-[var(--brand)] text-white shadow-md'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
        style={
          !isEditing
            ? { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
            : undefined
        }
      >
        {isEditing ? (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Concluir edição
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Personalizar layout
          </>
        )}
      </button>

      {isEditing && (
        <>
          <span className="text-xs text-slate-500" style={{ color: 'var(--text-muted)' }}>
            Arraste, oculte ou redimensione os blocos
          </span>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="ml-auto rounded-2xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Resetar layout
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-amber-600">Resetar para o padrão?</span>
              <button
                type="button"
                onClick={() => {
                  resetPageLayout(pagePath);
                  setConfirmReset(false);
                }}
                className="rounded-xl bg-rose-600 px-3 py-1 text-xs text-white hover:bg-rose-700"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                style={{ borderColor: 'var(--border)' }}
              >
                Não
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

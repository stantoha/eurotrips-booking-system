// ============================================================
// EUROTRIPS — DocumentCard Component
// OPS UX C-3, Wireframe 6 «Документи виїзду».
// Підключено в TourDetail.tsx (вкладка "Документи") — DocumentType
// розширено значеннями rooming_hotel/passenger_list (OPS-18/19),
// PDF генерується через Puppeteer і зберігається в storage/documents/
// (локально, не персистентно між деплоями на Railway — TODO S3).
// onSend поки не реалізовано (немає email-шаблону під ці типи).
//
// Оновлено за дизайн-системою: додано статуси signed/expired/missing,
// мета-рядок з типом файлу та розміром, обгортку DocumentList,
// кнопки на примітивах DS. Токени замість slate-* — темна тема
// підхоплюється сама.
// ============================================================

import React from 'react';
import { FileText, Eye, Download, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/Feedback';

export type DocumentUiStatus = 'draft' | 'ready' | 'sent' | 'signed' | 'expired' | 'missing';

export interface OpsDocument {
  id: string;
  title: string;
  subtitle: string;
  status: DocumentUiStatus;
  generatedAt?: string | null;
  sentTo?: string | null;
  /** Тип файлу — «PDF», «XLSX» */
  kind?: string;
  /** Розмір файлу, КБ */
  sizeKb?: number | null;
  /** Хто згенерував */
  author?: string;
}

const STATUS_CONFIG: Record<DocumentUiStatus, { label: string; classes: string }> = {
  draft:   { label: 'Чернетка',    classes: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border' },
  ready:   { label: 'Готово',      classes: 'bg-status-success-bg text-status-success-fg border-status-success-border' },
  sent:    { label: 'Надіслано',   classes: 'bg-status-info-bg text-status-info-fg border-status-info-border' },
  signed:  { label: 'Підписано',   classes: 'bg-status-success-bg text-status-success-fg border-status-success-border' },
  expired: { label: 'Прострочено', classes: 'bg-status-danger-bg text-status-danger-fg border-status-danger-border' },
  missing: { label: 'Відсутній',   classes: 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border' },
};

export const DOCUMENT_STATUSES = Object.keys(STATUS_CONFIG) as DocumentUiStatus[];

export interface DocumentCardProps {
  document: OpsDocument;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  onSend?: (id: string) => void;
  onGenerate?: (id: string) => void;
  isGenerating?: boolean;
  className?: string;
}

/** «PDF · 240 КБ · 04.07.2026 · Ольга» — усе, що відомо про файл, одним рядком */
function metaLine(doc: OpsDocument): string {
  return [
    doc.subtitle,
    doc.kind,
    doc.sizeKb != null ? `${doc.sizeKb.toLocaleString('uk-UA')} КБ` : null,
    doc.generatedAt ? new Date(doc.generatedAt).toLocaleDateString('uk-UA') : null,
    doc.sentTo,
    doc.author,
  ].filter(Boolean).join(' · ');
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document, onView, onDownload, onSend, onGenerate, isGenerating = false, className = '',
}) => {
  const cfg = STATUS_CONFIG[document.status] ?? STATUS_CONFIG.draft;
  // Чернетки й відсутні файли ще нічим переглядати
  const needsGeneration = document.status === 'draft' || document.status === 'missing';

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-0 ${className}`.trim()}>
      <div className="w-8 h-8 rounded-tile bg-surface-2 flex items-center justify-center shrink-0">
        <FileText size={15} className="text-content-tertiary" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-content-primary truncate">{document.title}</p>
        <p className="text-caption text-content-tertiary truncate">{metaLine(document)}</p>
      </div>

      <span className={`text-micro font-medium px-2 py-0.5 rounded-pill border shrink-0 ${cfg.classes}`}>
        {cfg.label}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        {needsGeneration ? (
          <Button size="xs" variant="primary" loading={isGenerating} onClick={() => onGenerate?.(document.id)}>
            Згенерувати
          </Button>
        ) : (
          <>
            <IconButton size="sm" label="Переглянути" onClick={() => onView?.(document.id)}>
              <Eye size={14} aria-hidden="true" />
            </IconButton>
            <IconButton size="sm" label="Завантажити" onClick={() => onDownload?.(document.id)}>
              <Download size={14} aria-hidden="true" />
            </IconButton>
            <IconButton size="sm" label="Надіслати email" onClick={() => onSend?.(document.id)}>
              <Send size={14} aria-hidden="true" />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
};

// ─── DOCUMENT LIST ───────────────────────────────────────────

export interface DocumentListProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  emptyLabel?: string;
  className?: string;
}

/** Обгортка набору документів виїзду — рамка, заголовок, порожній стан */
export const DocumentList: React.FC<DocumentListProps> = ({
  title, children, emptyLabel = 'Документи ще не сформовані.', className = '',
}) => {
  const isEmpty = React.Children.count(children) === 0;

  return (
    <div className={`border border-line rounded-panel overflow-hidden ${className}`.trim()}>
      {title && (
        <div className="px-3 py-2 bg-surface-2 text-micro uppercase tracking-eyebrow font-semibold text-content-tertiary">
          {title}
        </div>
      )}
      {isEmpty ? <p className="text-sm text-content-tertiary px-3 py-6 text-center">{emptyLabel}</p> : children}
    </div>
  );
};

export default DocumentCard;

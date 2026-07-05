// ============================================================
// EUROTRIPS — DocumentCard Component
// OPS UX C-3, Wireframe 6 «Документи виїзду».
//
// ПРИМІТКА: презентаційний компонент. Prisma-модель Document вже існує,
// але її DocumentType (voucher/contract/invoice/tourist_list/
// boarding_list/letter/pdf_report) не покриває OPS-специфічні типи
// з UX-специфікації (rooming_hotel, passenger_list, addon_list,
// contact_list, info_letter) — і немає GET /tours/:id/documents.
// Компонент готовий до підключення після узгодження типів документів
// між OPS-модулем і генеральною моделлю Document.
// ============================================================

import React from 'react';
import { FileText, Eye, Download, Send, Loader2 } from 'lucide-react';

export type DocumentUiStatus = 'draft' | 'ready' | 'sent';

export interface OpsDocument {
  id: string;
  title: string;
  subtitle: string;
  status: DocumentUiStatus;
  generatedAt?: string | null;
  sentTo?: string | null;
}

const STATUS_CONFIG: Record<DocumentUiStatus, { label: string; classes: string }> = {
  draft: { label: 'Чернетка', classes: 'bg-brand-gold/10 text-brand-gold-dark border-brand-gold/30' },
  ready: { label: 'Готово', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' },
  sent:  { label: 'Надіслано', classes: 'bg-brand-cyan/10 text-brand-cyan-dark border-brand-cyan/30' },
};

export interface DocumentCardProps {
  document: OpsDocument;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  onSend?: (id: string) => void;
  onGenerate?: (id: string) => void;
  isGenerating?: boolean;
  className?: string;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document, onView, onDownload, onSend, onGenerate, isGenerating = false, className = '',
}) => {
  const cfg = STATUS_CONFIG[document.status];

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
        <FileText size={15} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{document.title}</p>
        <p className="text-[11px] text-slate-400 truncate">
          {document.subtitle}
          {document.generatedAt && ` · ${new Date(document.generatedAt).toLocaleDateString('uk-UA')}`}
          {document.sentTo && ` · ${document.sentTo}`}
        </p>
      </div>
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${cfg.classes}`}>{cfg.label}</span>
      <div className="flex items-center gap-1 shrink-0">
        {document.status === 'draft' ? (
          <button
            onClick={() => onGenerate?.(document.id)}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-50 transition-colors"
          >
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : null}
            Згенерувати
          </button>
        ) : (
          <>
            <button onClick={() => onView?.(document.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Переглянути">
              <Eye size={14} />
            </button>
            <button onClick={() => onDownload?.(document.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Завантажити">
              <Download size={14} />
            </button>
            <button onClick={() => onSend?.(document.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Надіслати email">
              <Send size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentCard;

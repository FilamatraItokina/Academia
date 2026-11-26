import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/45 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full ${widthClass} bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col`}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0 bg-white">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}

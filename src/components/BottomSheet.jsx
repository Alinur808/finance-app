import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Mobile bottom sheet with backdrop; closes on backdrop tap or Escape. */
export default function BottomSheet({ open, onClose, title, children, footer, tall = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-gray-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`absolute bottom-0 flex w-full max-w-md animate-sheet-in flex-col rounded-t-[28px] bg-white ${tall ? 'h-[92dvh]' : 'max-h-[88dvh]'}`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-ink-soft active:bg-gray-200" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-gray-100 px-5 pt-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>{footer}</div>}
      </div>
    </div>
  );
}

/** A tappable option row used inside sheets. */
export function SheetOption({ selected, onClick, children, leading }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:bg-gray-100 ${selected ? 'bg-brand-50' : ''}`}
    >
      {leading}
      <span className="flex-1 font-medium">{children}</span>
      <span
        className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? 'border-brand-600 bg-brand-600' : 'border-gray-300'}`}
        aria-hidden="true"
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}

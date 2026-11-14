import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

let openSheets = 0; // вложенные листы: фон разблокируем, когда закрылся последний

const CLOSE_MS = 220;
const DISMISS_DISTANCE = 110; // px вниз, после которых лист закрывается
const DISMISS_VELOCITY = 0.6; // px/мс — быстрый смахивающий жест

/**
 * Нижний лист в стиле iOS:
 * - открывается и закрывается анимацией (transform/opacity — на GPU);
 * - смахивается вниз за «ручку» и заголовок;
 * - пока открыт, фон не прокручивается;
 * - закрывается по фону, крестику и Escape.
 */
export default function BottomSheet({ open, onClose, title, children, footer, tall = false }) {
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragRef = useRef(null);
  const closeTimer = useRef(null);

  const requestClose = useCallback(() => {
    if (closeTimer.current) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setClosing(false);
      setDrag(0);
      onClose();
    }, CLOSE_MS);
  }, [onClose]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    openSheets += 1;
    document.documentElement.classList.add('sheet-open');
    const onKey = (e) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openSheets = Math.max(0, openSheets - 1);
      if (!openSheets) document.documentElement.classList.remove('sheet-open');
    };
  }, [open, requestClose]);

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return;
    dragRef.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setDrag(Math.max(0, e.clientY - dragRef.current.y));
  };
  const onPointerUp = (e) => {
    if (!dragRef.current) return;
    const distance = Math.max(0, e.clientY - dragRef.current.y);
    const velocity = distance / Math.max(1, performance.now() - dragRef.current.t);
    dragRef.current = null;
    if (distance > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) requestClose();
    else setDrag(0);
  };

  if (!open) return null;
  const dragging = Boolean(dragRef.current);
  return (
    <div className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-0 bg-gray-900/40 ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
        style={{ opacity: drag ? Math.max(0.2, 1 - drag / 400) : undefined, touchAction: 'none' }}
        onClick={requestClose}
      />
      <div
        className={`absolute bottom-0 flex w-full max-w-md flex-col rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)] ${closing ? 'animate-sheet-out' : 'animate-sheet-in'} ${tall ? 'h-[92dvh]' : 'max-h-[88dvh]'}`}
        style={{
          transform: !closing && drag ? `translate3d(0, ${drag}px, 0)` : undefined,
          transition: dragging || closing ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          '--drag': `${drag}px`,
        }}
      >
        <div
          className="cursor-grab touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-gray-200" />
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            <button onClick={requestClose} className="pressable grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-ink-soft active:bg-gray-200" aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-gray-100 px-5 pt-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** A tappable option row used inside sheets. */
export function SheetOption({ selected, onClick, children, leading }) {
  return (
    <button
      onClick={onClick}
      className={`pressable flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:bg-gray-100 ${selected ? 'bg-brand-50' : ''}`}
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

import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(onDone, 2200);
    return () => clearTimeout(id);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-md justify-center px-5" style={{ bottom: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex animate-rise-in items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg" role="status">
        <CheckCircle2 size={18} className="text-brand-300" />
        {message}
      </div>
    </div>
  );
}

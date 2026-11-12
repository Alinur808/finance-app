import { LayoutGrid, PieChart, Plus, Target, User } from 'lucide-react';

export const TABS = [
  { id: 'overview', label: 'Обзор', icon: LayoutGrid },
  { id: 'analytics', label: 'Аналитика', icon: PieChart },
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'profile', label: 'Профиль', icon: User },
];

/** Fixed bottom bar with a raised floating "+" in the middle. */
export default function BottomNav({ active, onChange, onAdd }) {
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const item = (t) => {
    const on = active === t.id;
    return (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={`flex flex-1 flex-col items-center gap-1 pt-2.5 text-[11px] font-semibold transition ${on ? 'text-brand-700' : 'text-ink-muted'}`}
        aria-current={on ? 'page' : undefined}
      >
        <t.icon size={22} strokeWidth={on ? 2.4 : 2} />
        {t.label}
      </button>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div
        className="relative flex border-t border-gray-100 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        {left.map(item)}
        <div className="flex w-20 justify-center">
          <button
            onClick={onAdd}
            className="absolute -top-6 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-float ring-[5px] ring-canvas transition active:scale-90"
            aria-label="Добавить операцию"
          >
            <Plus size={30} strokeWidth={2.6} />
          </button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}

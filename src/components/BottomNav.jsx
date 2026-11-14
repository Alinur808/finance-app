import { LayoutGrid, PieChart, Plus, Target, User } from 'lucide-react';
import { haptic } from '../utils/haptics.js';

export const TABS = [
  { id: 'overview', label: 'Обзор', icon: LayoutGrid },
  { id: 'analytics', label: 'Аналитика', icon: PieChart },
  { id: 'goals', label: 'Планы', icon: Target },
  { id: 'profile', label: 'Профиль', icon: User },
];

/** Стеклянная нижняя панель с приподнятой кнопкой «+» по центру. */
export default function BottomNav({ active, onChange, onAdd }) {
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const item = (t) => {
    const on = active === t.id;
    return (
      <button
        key={t.id}
        onClick={() => {
          if (!on) haptic('selection');
          onChange(t.id);
        }}
        className={`flex flex-1 flex-col items-center gap-1 pt-2.5 text-[11px] font-medium transition-colors ${on ? 'text-ink' : 'text-ink-muted'}`}
        aria-current={on ? 'page' : undefined}
      >
        <t.icon size={22} strokeWidth={on ? 2.3 : 1.8} />
        {t.label}
      </button>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div
        className="relative flex border-t border-hairline bg-canvas/80 backdrop-blur-xl backdrop-saturate-150"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        {left.map(item)}
        <div className="flex w-20 justify-center">
          <button
            onClick={() => {
              haptic('medium');
              onAdd();
            }}
            className="absolute -top-6 grid h-16 w-16 place-items-center rounded-full bg-ink text-on-ink shadow-float ring-[5px] ring-canvas transition active:scale-90"
            aria-label="Добавить операцию"
          >
            <Plus size={28} strokeWidth={2.4} />
          </button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}

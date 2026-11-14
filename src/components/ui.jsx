import { haptic } from '../utils/haptics.js';

/** Small shared presentational pieces. */

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-3xl bg-surface shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
      {action &&
        (onAction ? (
          <button onClick={onAction} className="text-sm font-semibold text-brand-700 transition-opacity active:opacity-60">
            {action}
          </button>
        ) : (
          <span className="tabular text-sm font-semibold text-ink-soft">{action}</span>
        ))}
    </div>
  );
}

export function ScreenHeader({ title, subtitle, right }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-4" style={{ paddingTop: 'max(24px, calc(env(safe-area-inset-top) + 12px))' }}>
      <div className="min-w-0">
        {subtitle && <p className="eyebrow">{subtitle}</p>}
        <h1 className="mt-0.5 text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 text-ink-muted">
        <Icon size={26} />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 text-sm text-ink-muted">{text}</p>}
    </div>
  );
}

export function PrimaryButton({ className = '', children, onClick, ...rest }) {
  return (
    <button
      className={`pressable h-14 w-full rounded-2xl bg-ink text-[16px] font-semibold text-on-ink disabled:bg-gray-100 disabled:text-ink-muted ${className}`}
      onClick={(e) => {
        haptic('light');
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic('selection');
        onChange(!on);
      }}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${on ? 'bg-brand-500' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-200 ${on ? 'translate-x-5' : ''}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
      />
    </button>
  );
}

/** iOS-style segmented control. items: [[id, label], …] */
export function Segmented({ value, onChange, items, className = '', size = 'md' }) {
  return (
    <div className={`grid rounded-2xl bg-gray-100 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} role="tablist">
      {items.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => {
            if (value !== id) haptic('selection');
            onChange(id);
          }}
          className={`${size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-[15px]'} truncate rounded-xl px-2 font-semibold transition-colors ${value === id ? 'bg-surface-raised text-ink shadow-card' : 'text-ink-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Small shared presentational pieces. */

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-3xl bg-white shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold tracking-tight text-ink">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-sm font-semibold text-brand-600 active:opacity-60">
          {action}
        </button>
      )}
    </div>
  );
}

export function ScreenHeader({ title, subtitle, right }) {
  return (
    <header className="flex items-end justify-between px-5 pb-4 pt-6">
      <div>
        {subtitle && <p className="text-sm font-medium text-ink-muted">{subtitle}</p>}
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink">{title}</h1>
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

export function PrimaryButton({ className = '', children, ...rest }) {
  return (
    <button
      className={`h-14 w-full rounded-2xl bg-brand-600 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:bg-gray-200 disabled:text-ink-muted ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

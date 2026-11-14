import { useCallback, useMemo, useRef, useState } from 'react';
import { usePrivacy } from '../hooks/usePrivacy.js';
import { addDays, formatDayMonth, isSameDay, weekdayShort } from '../utils/dates.js';
import { haptic } from '../utils/haptics.js';

const W = 340;
const GAP = 2; // зазор между соседними столбцами (цвет поверхности)
const R = 3; // скругление только на «дальнем» конце столбца

/** Столбец от нулевой линии: вверх (dir = -1) или вниз (dir = 1), скруглён только конец. */
function bar(x, base, w, h, dir) {
  if (h <= 0.5) return '';
  const r = Math.min(R, w / 2, h);
  const tip = base + dir * h;
  const inner = tip - dir * r;
  return `M${x} ${base}V${inner}Q${x} ${tip} ${x + r} ${tip}H${x + w - r}Q${x + w} ${tip} ${x + w} ${inner}V${base}Z`;
}

const label = (b) => (b.weekly ? `${formatDayMonth(b.start)} – ${formatDayMonth(addDays(b.end, -1))}` : `${weekdayShort(b.start)}, ${formatDayMonth(b.start)}`);

/**
 * Доходы и расходы: доходы вверх, расходы вниз — на одной шкале в тенге.
 * Ведите пальцем по графику — строка над ним показывает точные суммы дня
 * (или недели). Без пальца — итоги всего периода. Ноль зависимостей: чистый SVG.
 */
export default function CashflowChart({ buckets, now, height = 168, caption = 'Итог за период', testId = 'cashflow-chart' }) {
  const { money } = usePrivacy();
  const [active, setActive] = useState(null);
  const svgRef = useRef(null);
  const lastIndex = useRef(null);
  const n = buckets.length;

  const geo = useMemo(() => {
    const maxIn = Math.max(0, ...buckets.map((b) => b.income));
    const maxOut = Math.max(0, ...buckets.map((b) => b.expense));
    const span = maxIn + maxOut || 1;
    // ось одна; ноль стоит там, где делится диапазон доходов и расходов
    const pad = 6;
    const plot = height - pad * 2;
    const zero = pad + plot * (maxIn / span || 0.5);
    const scale = plot / span;
    return { zero, scale, pad };
  }, [buckets, height]);

  const totals = useMemo(() => buckets.reduce((t, b) => ({ income: t.income + b.income, expense: t.expense + b.expense }), { income: 0, expense: 0 }), [buckets]);

  const pick = useCallback(
    (clientX) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !n) return;
      const i = Math.max(0, Math.min(n - 1, Math.floor(((clientX - rect.left) / rect.width) * n)));
      if (i !== lastIndex.current) {
        lastIndex.current = i;
        haptic('selection');
      }
      setActive(i);
    },
    [n],
  );

  if (!n) return null;
  const slot = W / n;
  const bw = Math.max(1, slot - GAP);
  const act = active != null ? buckets[active] : null;
  const shown = act ?? totals;
  const net = shown.income - shown.expense;
  const labelEvery = n <= 8 ? 1 : n <= 16 ? 3 : 7;
  const weekly = buckets[0].weekly;

  const end = () => {
    lastIndex.current = null;
    setActive(null);
  };

  return (
    <div className="select-none" data-testid={testId}>
      {/* строка значений: итоги периода или точка под пальцем */}
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-ink-muted" data-testid="cashflow-label">
            {act ? label(act) : caption}
          </p>
          <p className={`tabular truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] ${net >= 0 ? 'text-ink' : 'text-red-600'}`} data-testid="cashflow-net">
            {money(net, { sign: true, decimals: false })}
          </p>
        </div>
        <dl className="shrink-0 space-y-0.5 text-right text-[12px]">
          <div className="flex items-center justify-end gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--chart-income)' }} aria-hidden="true" />
            <dt className="text-ink-muted">Доходы</dt>
            <dd className="tabular min-w-[84px] font-semibold text-ink">{money(shown.income, { decimals: false })}</dd>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--chart-burn)' }} aria-hidden="true" />
            <dt className="text-ink-muted">Расходы</dt>
            <dd className="tabular min-w-[84px] font-semibold text-ink">{money(shown.expense, { decimals: false })}</dd>
          </div>
        </dl>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height + 18}`}
        className="block w-full overflow-visible"
        style={{ touchAction: 'pan-y' }}
        role="img"
        aria-label={`Доходы ${money(totals.income)}, расходы ${money(totals.expense)}`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) && pick(e.clientX)}
        onPointerUp={(e) => e.pointerType !== 'mouse' && end()}
        onPointerLeave={end}
        onPointerCancel={end}
      >
        <line x1="0" x2={W} y1={geo.zero} y2={geo.zero} style={{ stroke: 'var(--chart-grid)' }} strokeWidth="1" />
        {buckets.map((b, i) => {
          const x = i * slot + GAP / 2;
          const dim = active != null && active !== i;
          const today = !weekly && isSameDay(b.start, now);
          return (
            <g key={i} opacity={dim ? 0.35 : 1} style={{ transition: 'opacity 120ms' }}>
              <path d={bar(x, geo.zero - 1, bw, b.income * geo.scale, -1)} style={{ fill: 'var(--chart-income)' }} />
              <path d={bar(x, geo.zero + 1, bw, b.expense * geo.scale, 1)} style={{ fill: 'var(--chart-burn)' }} />
              {(i % labelEvery === 0 || i === n - 1) && (n - 1 - i >= labelEvery / 2 || i === n - 1) && (
                <text x={x + bw / 2} y={height + 14} textAnchor="middle" fontSize="10" fontWeight={today ? 700 : 500} style={{ fill: 'rgb(var(--ink-muted))' }}>
                  {weekly ? formatDayMonth(b.start) : n <= 8 ? weekdayShort(b.start) : b.start.getDate()}
                </text>
              )}
            </g>
          );
        })}
        {act && (
          <line
            x1={active * slot + slot / 2}
            x2={active * slot + slot / 2}
            y1={0}
            y2={height}
            style={{ stroke: 'rgb(var(--ink))' }}
            strokeOpacity="0.5"
            strokeWidth="1"
            strokeDasharray="2 3"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* та же информация таблицей — для VoiceOver */}
      <table className="sr-only">
        <caption>Доходы и расходы по {weekly ? 'неделям' : 'дням'}</caption>
        <thead>
          <tr>
            <th>Период</th>
            <th>Доходы</th>
            <th>Расходы</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => (
            <tr key={i}>
              <td>{label(b)}</td>
              <td>{money(b.income)}</td>
              <td>{money(b.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

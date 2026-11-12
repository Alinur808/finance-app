import { useState } from 'react';
import { formatDayMonth, isSameDay, weekdayShort, addDays } from '../utils/dates.js';
import { formatMoney } from '../utils/format.js';

const H = 150;
const TOP_PAD = 8;

function barPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  if (h <= 0) return '';
  return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
}

/**
 * Single-series spending columns with an average reference line.
 * Hover (desktop) or tap (mobile) a column for its exact amount.
 */
export default function SpendingBars({ buckets, now }) {
  const [active, setActive] = useState(null);
  const n = buckets.length;
  if (!n) return null;
  const W = 340;
  const slot = W / n;
  const gap = Math.max(2, Math.min(6, slot * 0.28));
  const bw = slot - gap;
  const max = Math.max(...buckets.map((b) => b.amount), 1);
  const avg = buckets.reduce((s, b) => s + b.amount, 0) / n;
  const y = (v) => TOP_PAD + (H - TOP_PAD) * (1 - v / max);
  const weekly = buckets[0].weekly;
  const labelEvery = n <= 8 ? 1 : n <= 16 ? 3 : 7;

  const label = (b) => (weekly ? `${formatDayMonth(b.start)} – ${formatDayMonth(addDays(b.end, -1))}` : `${weekdayShort(b.start)}, ${formatDayMonth(b.start)}`);
  const act = active != null ? buckets[active] : null;

  return (
    <div className="relative select-none">
      {act && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-ink px-3 py-1.5 text-center text-white shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, ((active + 0.5) / n) * 100))}%` }}
        >
          <p className="text-[11px] text-white/70">{label(act)}</p>
          <p className="tabular text-sm font-bold">{formatMoney(act.amount)}</p>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full overflow-visible" role="img" aria-label="Расходы по дням">
        <line x1="0" x2={W} y1={H} y2={H} stroke="#e5e7eb" />
        {buckets.map((b, i) => {
          const top = y(b.amount);
          const isToday = !weekly && isSameDay(b.start, now);
          const fill = active === i ? '#0b6e48' : isToday ? '#38b07c' : '#16a06a';
          return (
            <g key={i}>
              <path d={barPath(i * slot + gap / 2, top, bw, H - top, 4)} fill={fill} opacity={active != null && active !== i ? 0.45 : 1} />
              {(i % labelEvery === 0 || i === n - 1) && (n - 1 - i >= labelEvery / 2 || i === n - 1) && (
                <text x={i * slot + slot / 2} y={H + 15} textAnchor="middle" fontSize="10" fill="#9ca3af">
                  {weekly ? formatDayMonth(b.start) : n <= 8 ? weekdayShort(b.start) : b.start.getDate()}
                </text>
              )}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
              />
            </g>
          );
        })}
        {avg > 0 && (
          <g pointerEvents="none">
            <line x1="0" x2={W} y1={y(avg)} y2={y(avg)} stroke="#4b5563" strokeDasharray="3 4" strokeWidth="1" />
            <text x={W} y={y(avg) - 4} textAnchor="end" fontSize="10" fontWeight="600" fill="#4b5563" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
              в среднем {formatMoney(avg, { compact: true })}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

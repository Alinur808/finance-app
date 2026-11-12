import { formatMoney, formatPercent } from '../utils/format.js';

const TAU = Math.PI * 2;

function segmentPath(cx, cy, r0, r1, a0, a1) {
  const pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = pt(r1, a0);
  const [x1, y1] = pt(r1, a1);
  const [x2, y2] = pt(r0, a1);
  const [x3, y3] = pt(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

/**
 * Category donut. Slices are separated by a 2px white stroke; hovering or
 * tapping a slice (or its legend row, via `activeId`) focuses it in the center.
 */
export default function DonutChart({ data, total, activeId, onActive, size = 208 }) {
  const cx = size / 2;
  const r1 = size / 2 - 4;
  const r0 = r1 - 26;
  const active = data.find((d) => d.id === activeId);

  let angle = 0;
  const slices = data.map((d) => {
    const sweep = total ? (d.value / total) * TAU : 0;
    const a0 = angle;
    const a1 = Math.min(angle + sweep, a0 + TAU - 0.0001);
    angle += sweep;
    return { ...d, a0, a1 };
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Расходы по категориям">
        {total === 0 && <circle cx={cx} cy={cx} r={(r0 + r1) / 2} fill="none" stroke="#f3f4f6" strokeWidth={r1 - r0} />}
        {slices.map((s) => {
          const dim = active && active.id !== s.id;
          return (
            <path
              key={s.id}
              d={segmentPath(cx, cx, active?.id === s.id ? r0 - 3 : r0, active?.id === s.id ? r1 + 3 : r1, s.a0, s.a1)}
              fill={s.color}
              stroke="#fff"
              strokeWidth={2}
              strokeLinejoin="round"
              opacity={dim ? 0.35 : 1}
              className="cursor-pointer transition-opacity duration-200"
              onPointerEnter={(e) => e.pointerType === 'mouse' && onActive(s.id)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && onActive(null)}
              onClick={() => onActive(activeId === s.id ? null : s.id)}
            >
              <title>{`${s.label}: ${formatMoney(s.value)} (${formatPercent(s.value / total)})`}</title>
            </path>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="max-w-[120px] truncate text-[12px] font-medium text-ink-muted">{active ? active.label : 'Всего потрачено'}</p>
        <p className="tabular text-[22px] font-extrabold tracking-tight">{formatMoney(active ? active.value : total, { compact: true })}</p>
        {active && <p className="tabular text-[12px] font-semibold text-ink-soft">{formatPercent(active.value / total, 1)}</p>}
      </div>
    </div>
  );
}

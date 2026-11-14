import { useLayoutEffect, useRef } from 'react';

/**
 * Одна строка, которая всегда помещается в ширину родителя: шрифт плавно
 * уменьшается от `max` до `min` px. Так 0 ₸ и 999 999 999 999 ₸ одинаково
 * аккуратно стоят в карточке, без переносов и обрезки.
 * Размер меняем напрямую в DOM (без setState) — нет лишних перерисовок.
 * Вложенные части (копейки, ₸) задавайте в em — они масштабируются вместе.
 */
export default function FitText({ children, max = 40, min = 18, className = '', as: Tag = 'span', ...rest }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return undefined;
    const fit = () => {
      el.style.fontSize = `${max}px`;
      const style = getComputedStyle(parent);
      const avail = parent.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
      const need = el.scrollWidth;
      if (avail > 0 && need > avail) el.style.fontSize = `${Math.max(min, Math.floor(((max * avail) / need) * 10) / 10)}px`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    // шрифт мог догрузиться после первого замера
    document.fonts?.ready?.then(fit).catch(() => {});
    return () => ro.disconnect();
  });

  return (
    <Tag ref={ref} className={`inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-bottom ${className}`} style={{ fontSize: max }} {...rest}>
      {children}
    </Tag>
  );
}

import { getCategory } from '../data/categories.js';

/** Иконка категории: пастель в Alabaster, цветное свечение на угольном в Obsidian (см. .cat-icon). */
export default function CategoryIcon({ categoryId, size = 44, className = '' }) {
  const cat = getCategory(categoryId);
  const Icon = cat.icon;
  return (
    <div
      className={`cat-icon grid shrink-0 place-items-center rounded-full ${className}`}
      style={{ width: size, height: size, '--cat-bg': cat.bg, '--cat-ink': cat.ink, '--cat-color': cat.color, '--cat-tint': `${cat.color}24` }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2} />
    </div>
  );
}

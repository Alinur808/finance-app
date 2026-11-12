import { getCategory } from '../data/categories.js';

/** Иконка категории на пастельной подложке (как в приложении Kaspi). */
export default function CategoryIcon({ categoryId, size = 44, className = '' }) {
  const cat = getCategory(categoryId);
  const Icon = cat.icon;
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: cat.bg, color: cat.ink }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2} />
    </div>
  );
}

import { AlertTriangle, BadgeCheck, PartyPopper, PenLine, TrendingDown } from 'lucide-react';

/** Статус цели (utils/advisor.js → buildAdvice().status) — общий для героя «Цель и темп трат» и стратега. */
export const GOAL_STATUS = {
  'on-track': { icon: BadgeCheck, label: 'Успеваете', cls: 'bg-brand-50 text-brand-700 ring-brand-500/20' },
  behind: { icon: AlertTriangle, label: 'Отстаёте от плана', cls: 'bg-amber-50 text-amber-800 ring-amber-500/20' },
  negative: { icon: TrendingDown, label: 'Тратите больше, чем получаете', cls: 'bg-red-50 text-red-700 ring-red-500/20' },
  done: { icon: PartyPopper, label: 'Цель достигнута', cls: 'bg-brand-50 text-brand-700 ring-brand-500/20' },
  'no-data': { icon: PenLine, label: 'Мало данных', cls: 'bg-gray-100 text-ink-soft ring-hairline' },
};

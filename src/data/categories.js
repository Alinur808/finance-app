import {
  UtensilsCrossed,
  Bike,
  ShoppingCart,
  CarTaxiFront,
  ArrowLeftRight,
  Repeat2,
  Gamepad2,
  ShoppingBag,
  Receipt,
  ArrowUpDown,
  Banknote,
  Wallet,
  Briefcase,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';

/**
 * Каждая категория:
 *  - color: цвет на графиках (фиксирован, не зависит от рейтинга)
 *  - bg / ink: пастельная подложка иконки и цвет самой иконки (как в Kaspi)
 *  - name: именительный падеж, для заголовков и списков («Доставка еды»)
 *  - nameAcc: винительный падеж со строчной буквы, для середины фразы
 *    после «на», «за», «тратите»: «тратите на доставку еды»
 *  - discretionary: расходы, которые Советник может предложить сократить
 *  - system: служебные категории, не показываются при ручном добавлении
 *  - internal: перемещение денег между своими счетами — влияет на баланс,
 *    но не считается ни доходом, ни расходом (аналитика и советник его не видят)
 */
export const CATEGORIES = {
  delivery: { id: 'delivery', name: 'Доставка еды', nameAcc: 'доставку еды', short: 'Доставка', type: 'expense', icon: Bike, color: '#eb6834', bg: '#fde9dd', ink: '#c4521f', discretionary: true },
  cafe: { id: 'cafe', name: 'Кафе и рестораны', nameAcc: 'кафе и рестораны', short: 'Кафе', type: 'expense', icon: UtensilsCrossed, color: '#eda100', bg: '#f6ecdc', ink: '#a8732b', discretionary: true },
  groceries: { id: 'groceries', name: 'Супермаркеты', nameAcc: 'супермаркеты', short: 'Продукты', type: 'expense', icon: ShoppingCart, color: '#1baf7a', bg: '#e2f3e6', ink: '#2e8a4f', discretionary: false },
  taxi: { id: 'taxi', name: 'Такси', nameAcc: 'такси', short: 'Такси', type: 'expense', icon: CarTaxiFront, color: '#2a78d6', bg: '#e3eefb', ink: '#2a66b3', discretionary: true },
  transfers: { id: 'transfers', name: 'Переводы', nameAcc: 'переводы', short: 'Переводы', type: 'expense', icon: ArrowLeftRight, color: '#6250d6', bg: '#ebe8fb', ink: '#5443bf', discretionary: false },
  entertainment: { id: 'entertainment', name: 'Игры и развлечения', nameAcc: 'игры и развлечения', short: 'Игры', type: 'expense', icon: Gamepad2, color: '#e87ba4', bg: '#fbe7ef', ink: '#c04a7a', discretionary: true },
  subscriptions: { id: 'subscriptions', name: 'Подписки и сервисы', nameAcc: 'подписки и сервисы', short: 'Подписки', type: 'expense', icon: Repeat2, color: '#e34948', bg: '#fce6e5', ink: '#bf3534', discretionary: true },
  shopping: { id: 'shopping', name: 'Покупки', nameAcc: 'покупки', short: 'Покупки', type: 'expense', icon: ShoppingBag, color: '#008300', bg: '#e4f1e0', ink: '#2f7a2f', discretionary: true },
  fees: { id: 'fees', name: 'Комиссии', nameAcc: 'комиссии', short: 'Комиссии', type: 'expense', icon: Receipt, color: '#a8a29e', bg: '#efeeec', ink: '#6b6762', discretionary: false },
  cash: { id: 'cash', name: 'Снятие наличных', nameAcc: 'снятие наличных', short: 'Наличные', type: 'expense', icon: Banknote, color: '#a8a29e', bg: '#efeeec', ink: '#6b6762', discretionary: false, system: true },
  own: { id: 'own', name: 'Между своими счетами', nameAcc: 'переводы между своими счетами', short: 'Свои счета', type: 'any', icon: ArrowRightLeft, color: '#c4c0b8', bg: '#eef0f3', ink: '#5b6472', discretionary: false, system: true, internal: true },
  fx: { id: 'fx', name: 'Курсовая разница', nameAcc: 'курсовую разницу', short: 'Курс', type: 'any', icon: ArrowUpDown, color: '#c4c0b8', bg: '#f1f0ec', ink: '#8a857c', discretionary: false, system: true },

  topup: { id: 'topup', name: 'Пополнения', nameAcc: 'пополнения', short: 'Пополнения', type: 'income', icon: Wallet, color: '#0f8a5a', bg: '#e1f3e8', ink: '#0f7a50' },
  salary: { id: 'salary', name: 'Зарплата', nameAcc: 'зарплату', short: 'Зарплата', type: 'income', icon: Briefcase, color: '#0f8a5a', bg: '#e1f3e8', ink: '#0f7a50' },
  refunds: { id: 'refunds', name: 'Возвраты', nameAcc: 'возвраты', short: 'Возвраты', type: 'income', icon: RotateCcw, color: '#138a72', bg: '#ddf3ee', ink: '#127664' },
};

export const OTHER_COLOR = '#a8a29e';

/** Категории для выбора вручную (без служебных). */
export const categoryList = (type) => Object.values(CATEGORIES).filter((c) => !c.system && (!type || c.type === type));

export const getCategory = (id) => CATEGORIES[id] ?? CATEGORIES.shopping;

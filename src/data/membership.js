/** Тарифы и возможности Private Membership (общие для контекста и пейвола). */
export const TIERS = {
  standard: { id: 'standard', label: 'Standard', price: 'Бесплатно' },
  private: { id: 'private', label: 'Private', price: 'Membership' },
};

/** Возможности, которые открывает Private. Текст — для пейвола и заглушек. */
export const FEATURES = {
  strategist: { title: 'Стратег без ограничений', text: 'Все советы по тратам, накоплениям и запасу денег — не только первые два.' },
  aiAdvisor: { title: 'ИИ-разбор капитала', text: 'Персональный анализ операций моделью Claude по вашему ключу API.' },
  statementHistory: { title: 'История выписок', text: 'Выписки любого банка за любое число месяцев — без замены прошлых периодов.' },
  diaryGoals: { title: 'Безлимитный дневник', text: 'Сколько угодно целей-покупок в плане до дедлайна.' },
  passcode: { title: 'Код-пароль', text: 'Блокировка при запуске и возврате в приложение. Face ID — в App Store-версии.' },
};

/** Лимиты бесплатного тарифа. */
export const STANDARD_LIMITS = { insights: 2, diaryItems: 3 };

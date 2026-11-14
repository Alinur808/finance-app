/**
 * Синтетические данные для e2e-тестов (без реальных выписок и имён).
 * makeState({ balance }) — состояние в формате localStorage 'tenge-finance.v2'.
 */
const CATS = [
  ['delivery', 'Talabat', 4200],
  ['cafe', 'Coffee Bar', 2600],
  ['groceries', 'Magnum', 9800],
  ['taxi', 'Yandex Go', 1900],
  ['subscriptions', 'Apple.com', 3490],
  ['shopping', 'Sulpak', 24990],
  ['transfers', 'Перевод: А. К.', 15000],
];

export function makeTransactions(now = new Date(), days = 45) {
  const txs = [];
  let n = 0;
  for (let d = 0; d < days; d += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, 12, 0, 0);
    if (day.getDate() === 5 || day.getDate() === 20) {
      txs.push({ id: `t-${n++}`, type: 'income', amount: 450000, categoryId: 'salary', merchant: 'Зарплата', accountId: 'kaspi', date: day.toISOString(), note: '' });
    }
    for (let k = 0; k < 2 + (d % 3); k += 1) {
      const [categoryId, merchant, base] = CATS[(d * 3 + k) % CATS.length];
      const at = new Date(day.getTime() - k * 3600_000);
      txs.push({
        id: `t-${n++}`,
        type: 'expense',
        amount: Math.round(base * (0.6 + ((d + k) % 5) * 0.2)),
        categoryId,
        merchant,
        accountId: 'kaspi',
        date: at.toISOString(),
        note: '',
      });
    }
  }
  return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function makeState({ balance = 1_250_000.5, transactions = makeTransactions(), settings = {}, plan } = {}) {
  const net = transactions.filter((t) => t.accountId === 'kaspi').reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const d = new Date();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    transactions,
    goals: [{ id: 'goal-1', name: 'Подушка безопасности', emoji: '🛟', target: 3_000_000, saved: 400_000, deadline: new Date(d.getFullYear(), d.getMonth() + 6, 1).toISOString() }],
    activeGoalId: 'goal-1',
    settings: {
      onboarded: true,
      hideBalance: false,
      monthlyBudget: 0,
      name: 'Алекс',
      aiApiKey: '',
      aiProvider: 'anthropic',
      cardName: 'Freedom Super Card',
      openings: { kaspi: Math.round((balance - net) * 100) / 100, cash: 0 },
      ...settings,
    },
    plan: plan ?? { deadline: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`, items: [], incomes: [] },
  };
}

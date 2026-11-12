import statement from './statement.json';

/**
 * Операции из выписки Kaspi Gold (scripts/parse_kaspi_statement.py → statement.json).
 * В выписке нет времени операций, поэтому ставим полдень местного времени,
 * а порядок внутри дня сохраняем через секунды (`seq`). Флаг `noTime`
 * скрывает это условное время в интерфейсе.
 */
export function statementTransactions() {
  return statement.transactions
    .map((row) => {
      const [y, m, d] = row.day.split('-').map(Number);
      const date = new Date(y, m - 1, d, 12, 0, 0);
      date.setSeconds(row.seq % 3600);
      return {
        id: `kaspi-${row.seq}`,
        type: row.type,
        amount: row.amount,
        categoryId: row.categoryId,
        merchant: row.merchant,
        accountId: 'kaspi',
        date: date.toISOString(),
        noTime: true,
        ...(row.original ? { original: row.original } : {}),
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const STATEMENT_PERIOD = statement.period;

export function defaultGoals(now = new Date()) {
  return [
    {
      id: 'goal-cushion',
      name: 'Финансовая подушка',
      emoji: '🛟',
      target: 500000,
      saved: 0,
      deadline: new Date(now.getFullYear(), now.getMonth() + 5, 1).toISOString(),
    },
  ];
}

import { useCallback, useEffect, useState } from 'react';
import { useFinance, useNow } from './context/FinanceContext.jsx';
import BottomNav from './components/BottomNav.jsx';
import AddTransactionSheet from './components/AddTransactionSheet.jsx';
import TransactionDetailSheet from './components/TransactionDetailSheet.jsx';
import Toast from './components/Toast.jsx';
import IOSInstallHint from './components/IOSInstallHint.jsx';
import Overview from './screens/Overview.jsx';
import Analytics from './screens/Analytics.jsx';
import Goals from './screens/Goals.jsx';
import Profile from './screens/Profile.jsx';
import { formatMoney } from './utils/format.js';

export default function App() {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, setFilters, settings } = useFinance();
  const now = useNow();
  const [tab, setTab] = useState('overview');
  const [goalsSection, setGoalsSection] = useState('goals');
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState(null);
  const toast = useCallback((m) => setMessage(m), []);
  const clearToast = useCallback(() => setMessage(null), []);
  const onSelectTx = useCallback((tx) => setSelectedId(tx.id), []);
  const selected = selectedId ? transactions.find((t) => t.id === selectedId) : null;

  const navigate = useCallback((next, section) => {
    if (next === 'goals' && section) setGoalsSection(section);
    setTab(next);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const firstRun = !settings.onboarded && transactions.length === 0;
  // после «Начать заново» и повторного старта — всегда на главный экран
  useEffect(() => {
    if (firstRun) setTab('overview');
  }, [firstRun]);

  const screens = {
    overview: <Overview now={now} onSelectTx={onSelectTx} onNavigate={navigate} toast={toast} />,
    analytics: (
      <Analytics
        now={now}
        onPickCategory={(id) => {
          setFilters({ categoryId: id });
          setTab('overview');
        }}
      />
    ),
    goals: <Goals now={now} toast={toast} section={goalsSection} onSection={setGoalsSection} />,
    profile: <Profile toast={toast} />,
  };

  return (
    <div className="relative mx-auto min-h-dvh max-w-md bg-canvas" style={{ paddingBottom: firstRun ? 0 : 'calc(96px + env(safe-area-inset-bottom))' }}>
      <main key={tab} className="animate-fade-in">
        {screens[firstRun ? 'overview' : tab]}
      </main>

      {!firstRun && <BottomNav active={tab} onChange={navigate} onAdd={() => setAdding(true)} />}

      <AddTransactionSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(tx) => {
          addTransaction(tx);
          setAdding(false);
          toast(`${tx.type === 'income' ? 'Доход' : 'Расход'} ${formatMoney(tx.amount)} добавлен`);
        }}
      />
      <TransactionDetailSheet
        tx={selected}
        onClose={() => setSelectedId(null)}
        onChangeCategory={(id, categoryId) => {
          updateTransaction(id, { categoryId });
          toast('Категория изменена');
        }}
        onDelete={(id) => {
          deleteTransaction(id);
          setSelectedId(null);
          toast('Операция удалена');
        }}
      />
      <IOSInstallHint />
      <Toast message={message} onDone={clearToast} />
    </div>
  );
}

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
  const { addTransaction, deleteTransaction, setFilters } = useFinance();
  const now = useNow();
  const [tab, setTab] = useState('overview');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState(null);
  const toast = useCallback((m) => setMessage(m), []);
  const clearToast = useCallback(() => setMessage(null), []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const screens = {
    overview: <Overview now={now} onSelectTx={setSelected} onNavigate={setTab} onAdd={() => setAdding(true)} toast={toast} />,
    analytics: (
      <Analytics
        now={now}
        onPickCategory={(id) => {
          setFilters({ categoryId: id });
          setTab('overview');
        }}
      />
    ),
    goals: <Goals now={now} toast={toast} />,
    profile: <Profile toast={toast} />,
  };

  return (
    <div className="relative mx-auto min-h-dvh max-w-md bg-canvas pb-28">
      <main key={tab} className="animate-fade-in">
        {screens[tab]}
      </main>

      <BottomNav active={tab} onChange={setTab} onAdd={() => setAdding(true)} />

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
        onClose={() => setSelected(null)}
        onDelete={(id) => {
          deleteTransaction(id);
          setSelected(null);
          toast('Операция удалена');
        }}
      />
      <IOSInstallHint />
      <Toast message={message} onDone={clearToast} />
    </div>
  );
}

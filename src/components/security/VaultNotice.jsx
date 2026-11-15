import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';

/**
 * Зашифрованные данные не открылись (ключ устройства потерян или IndexedDB
 * временно недоступна). Ничего не перезаписываем: сначала предлагаем
 * перезапустить приложение, и только по явному выбору — начать заново.
 */
export default function VaultNotice() {
  const { vaultStatus, discardUnreadableVault } = useFinance();
  const [confirm, setConfirm] = useState(false);
  if (vaultStatus !== 'unreadable') return null;
  return (
    <div className="sticky top-0 z-[70] bg-red-50 px-5 py-3 text-red-800" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }} role="alert" data-testid="vault-notice">
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <ShieldAlert size={16} /> Не удалось открыть зашифрованные данные
      </p>
      <p className="mt-1 text-[12px] leading-snug">Закройте и снова откройте приложение. Пока данные не открыты, изменения не сохраняются — прошлые данные не перезаписываются.</p>
      {confirm ? (
        <div className="mt-2 flex gap-2">
          <button onClick={discardUnreadableVault} className="h-9 flex-1 rounded-xl bg-red-600 text-[13px] font-semibold text-white">
            Удалить и начать заново
          </button>
          <button onClick={() => setConfirm(false)} className="h-9 flex-1 rounded-xl bg-surface text-[13px] font-semibold text-ink-soft">
            Отмена
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="mt-2 text-[12px] font-semibold underline">
          Начать заново (восстановить из резервной копии)
        </button>
      )}
    </div>
  );
}

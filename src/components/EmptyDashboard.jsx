import { FileUp, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { useBackupImport } from '../hooks/useBackupImport.js';

/**
 * Обзор, когда операций ещё нет (например, первый запуск публичной сборки
 * на GitHub Pages). Вместо пустых графиков — одна понятная кнопка импорта.
 */
export default function EmptyDashboard({ name, onAdd, toast }) {
  // Данных нет — заменять нечего, поэтому импортируем без подтверждения.
  const { openPicker, inputProps, error, busy } = useBackupImport({ toast, autoConfirm: true });

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <div className="bg-gradient-to-b from-brand-800 to-brand-900 px-5 pb-10 text-white" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <p className="pt-2 text-sm text-white/70">{name?.trim() ? `Здравствуйте, ${name.trim()}` : 'Здравствуйте!'}</p>
        <p className="mt-6 text-[13px] text-white/70">Текущий баланс</p>
        <p className="tabular text-[34px] font-extrabold leading-none tracking-tight">
          0<span className="text-[24px] text-white/70">,00</span> <span className="text-[26px] text-white/80">₸</span>
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-50 text-brand-600">
          <FileUp size={30} />
        </div>
        <h2 className="mt-5 text-[22px] font-extrabold tracking-tight" style={{ textWrap: 'balance' }}>
          Загрузите свои данные
        </h2>
        <p className="mt-2 max-w-[300px] text-[15px] leading-snug text-ink-soft">
          Выберите файл резервной копии (JSON), сохранённый через «Экспорт данных», — и здесь появятся баланс, операции и аналитика.
        </p>

        <button
          onClick={openPicker}
          disabled={busy}
          className="mt-7 flex h-14 w-full max-w-[300px] items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[16px] font-semibold text-white shadow-float transition active:scale-[0.98] disabled:opacity-70"
        >
          {busy ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} />}
          Импорт данных
        </button>
        <input id="empty-import-file" {...inputProps} />

        {error && <p className="mt-3 max-w-[300px] rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

        <button onClick={onAdd} className="mt-3 flex h-11 items-center gap-1.5 px-4 text-[14px] font-semibold text-brand-700 active:opacity-60">
          <Plus size={17} /> Или добавить операцию вручную
        </button>

        <p className="mt-8 flex max-w-[300px] items-start gap-2 text-left text-[12px] leading-snug text-ink-muted">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          Файл читается прямо на телефоне и никуда не отправляется. Данные хранятся только в этом браузере.
        </p>
      </div>
    </div>
  );
}

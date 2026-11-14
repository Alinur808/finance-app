import { useEffect, useState } from 'react';
import { PlusSquare, Share, X } from 'lucide-react';
import { rememberIOSInstallHintDismissed, shouldShowIOSInstallHint } from '../utils/platform.js';

/**
 * Подсказка для iPhone/iPad: как установить приложение на экран «Домой».
 * Появляется через 2 секунды после запуска, только в Safari и только во вкладке браузера.
 * Закреплена вверху экрана, чтобы не перекрывать кнопку «Импорт данных» и нижнюю навигацию.
 */
export default function IOSInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShowIOSInstallHint()) return undefined;
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const close = () => {
    rememberIOSInstallHintDismissed();
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 z-[45] mx-auto max-w-md px-4" style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }} role="dialog" aria-labelledby="ios-hint-title">
      <div className="animate-rise-in rounded-3xl bg-[#15171d] p-4 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
        <div className="flex items-start gap-3">
          <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p id="ios-hint-title" className="text-[15px] font-bold">
              Установите приложение
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/75">Оно откроется на весь экран и будет работать без интернета.</p>
          </div>
          <button onClick={close} className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 active:bg-white/10" aria-label="Закрыть подсказку">
            <X size={18} />
          </button>
        </div>

        <ol className="mt-3 space-y-2 rounded-2xl bg-white/10 p-3 text-[14px]">
          <li className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15">
              <Share size={16} />
            </span>
            <span>
              Нажмите <b>«Поделиться»</b> в панели Safari
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15">
              <PlusSquare size={16} />
            </span>
            <span>
              Выберите <b>«На экран „Домой“»</b>
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

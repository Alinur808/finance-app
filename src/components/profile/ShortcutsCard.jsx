import { useState } from 'react';
import { Check, Copy, Smartphone } from 'lucide-react';
import { haptic } from '../../utils/haptics.js';

/** Живая ссылка для «Команд»: адрес этого приложения + параметры быстрого ввода. */
export function shortcutUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return '';
  return `${loc.origin}${loc.pathname}?quickAdd=1&type=expense&amount=&merchant=`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // старый Safari / нет разрешения — запасной способ через выделение
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

const STEPS = [
  ['Команды → Автоматизация → «+» → «Транзакция»', 'Выберите карту Apple Pay и включите «Запускать сразу».'],
  ['Действие «Открыть URL» — вставьте ссылку', 'После amount= вставьте переменную «Сумма», после merchant= — «Продавец».'],
  ['Оплатите Apple Pay', 'Приложение откроется с готовой операцией — проверьте и нажмите «Добавить».'],
];

/**
 * «Автоматизация Apple Pay (Команды iOS)»: копирование живой ссылки и 3 шага настройки.
 * Ссылка только открывает лист с черновиком — без нажатия «Добавить» ничего не сохраняется.
 */
export default function ShortcutsCard({ toast }) {
  const [copied, setCopied] = useState(false);
  const url = shortcutUrl();

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-card" data-testid="shortcuts-card">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-on-ink">
          <Smartphone size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">Автоматизация Apple Pay (Команды iOS)</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">Оплатили телефоном — операция уже ждёт подтверждения в приложении.</p>
        </div>
      </div>

      <ol className="mt-3 space-y-2.5">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-100 text-[12px] font-bold text-ink-soft">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug">{title}</p>
              <p className="text-[12px] leading-snug text-ink-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-3 break-all rounded-xl bg-gray-50 px-3 py-2 font-mono text-[11px] leading-snug text-ink-soft" data-testid="shortcut-url">
        {url}
      </p>
      <button
        onClick={async () => {
          const ok = await copyText(url);
          haptic(ok ? 'success' : 'error');
          setCopied(ok);
          toast?.(ok ? 'Ссылка скопирована — вставьте её в «Открыть URL»' : 'Не удалось скопировать — выделите ссылку вручную');
          if (ok) setTimeout(() => setCopied(false), 2500);
        }}
        className="pressable mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[14px] font-semibold text-on-ink"
        data-testid="copy-shortcut"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Скопировано' : 'Скопировать ссылку для Команд'}
      </button>
      <p className="mt-2 text-[11px] leading-snug text-ink-muted">
        Ссылка открывает приложение там, где оно установлено по этому адресу. Сумма и продавец проверяются и очищаются, а сохраняется операция только после вашего нажатия.
      </p>
    </div>
  );
}

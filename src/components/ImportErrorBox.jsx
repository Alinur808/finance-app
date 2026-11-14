import { useState } from 'react';
import { AlertCircle, Check, Copy } from 'lucide-react';

/**
 * Ошибка импорта: понятный текст + точная техническая причина.
 * Кнопка копирует подробности (этап, ошибку, версию pdf.js, устройство),
 * чтобы их можно было переслать разработчику — консоли на телефоне не видно.
 */
export default function ImportErrorBox({ error, className = '' }) {
  const [copied, setCopied] = useState(false);
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  const details = typeof error === 'string' ? '' : error.details;
  const report = [message, details, `Устройство: ${navigator.userAgent}`, `Время: ${new Date().toISOString()}`].filter(Boolean).join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // буфер обмена недоступен — выделяем текст, чтобы скопировать вручную
      const node = document.getElementById('import-error-details');
      if (node) window.getSelection()?.selectAllChildren(node);
    }
  };

  return (
    <div className={`rounded-2xl bg-red-50 px-3 py-2.5 text-left text-[13px] leading-snug text-red-800 ring-1 ring-red-100 ${className}`} role="alert">
      <p className="flex gap-1.5 font-medium">
        <AlertCircle size={16} className="mt-px shrink-0" />
        <span>{message}</span>
      </p>
      {details && (
        <details className="mt-2 group">
          <summary className="cursor-pointer list-none text-[12px] font-semibold text-red-700 underline decoration-red-300 underline-offset-2">
            Подробности для разработчика
          </summary>
          <pre
            id="import-error-details"
            className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface/70 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-red-900"
          >
            {details}
          </pre>
          <button onClick={copy} className="mt-2 flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold text-red-700 active:bg-red-100">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Скопировано' : 'Скопировать подробности'}
          </button>
        </details>
      )}
    </div>
  );
}

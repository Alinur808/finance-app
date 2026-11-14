import { useCallback, useEffect, useState } from 'react';
import { haptic } from '../../utils/haptics.js';
import { PASSCODE_LENGTH } from '../../utils/passcode.js';
import Keypad, { PasscodeDots } from './Keypad.jsx';

/**
 * Полноэкранный ввод кода (общий для блокировки, создания и отключения кода).
 * onComplete(code) → true (принят) | false (неверно: тряска и сброс) | строка (своё сообщение об ошибке).
 */
export default function PasscodeScreen({ title, subtitle, onComplete, onBiometric, footer, header, resetKey, disabled = false, testId }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');

  // новый шаг (например, «повторите код») — пустые точки; сообщение об ошибке остаётся
  useEffect(() => {
    setCode('');
    setError(false);
  }, [resetKey]);

  const submit = useCallback(
    (full) => {
      // даём увидеть четвёртую точку, потом проверяем
      setTimeout(() => {
        const result = onComplete(full);
        if (result === true) {
          haptic('success');
          setMessage('');
          return;
        }
        haptic('error');
        setError(true);
        setMessage(typeof result === 'string' ? result : '');
        setTimeout(() => {
          setError(false);
          setCode('');
        }, 450);
      }, 90);
    },
    [onComplete],
  );

  const onDigit = useCallback(
    (d) => {
      if (!error) setMessage((m) => (code.length === 0 ? '' : m));
      setCode((c) => {
        if (c.length >= PASSCODE_LENGTH) return c;
        const next = c + d;
        if (next.length === PASSCODE_LENGTH) submit(next);
        return next;
      });
    },
    [submit, error, code.length],
  );
  const onDelete = useCallback(() => setCode((c) => c.slice(0, -1)), []);

  return (
    <div
      className="fixed inset-0 z-[100] mx-auto flex max-w-md flex-col bg-canvas animate-fade-in"
      style={{ paddingTop: 'max(28px, calc(env(safe-area-inset-top) + 20px))', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', height: '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={testId}
    >
      {header}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-surface text-[22px] font-semibold tracking-tight shadow-card" aria-hidden="true">
          ₸
        </div>
        <h1 className="mt-5 text-[20px] font-semibold tracking-tight">{title}</h1>
        <p className={`mt-1.5 h-10 max-w-[280px] text-center text-[14px] leading-snug ${message ? 'text-red-600' : 'text-ink-muted'}`} aria-live="polite">
          {message || subtitle}
        </p>
        <div className="mt-4">
          <PasscodeDots length={code.length} error={error} />
        </div>
      </div>
      <div className="px-6 pb-2">
        <Keypad onDigit={onDigit} onDelete={onDelete} onBiometric={onBiometric} disabled={disabled || error} canDelete={code.length > 0} />
        <div className="mt-4 flex h-11 items-center justify-center">{footer}</div>
      </div>
    </div>
  );
}

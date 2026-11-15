import { useEffect, useState } from 'react';
import { useSecurity } from '../../context/SecurityContext.jsx';
import { useFinance } from '../../context/FinanceContext.jsx';
import { plural } from '../../utils/format.js';
import PasscodeScreen from './PasscodeScreen.jsx';

/**
 * Экран блокировки: код-пароль, Face ID / Touch ID (WebAuthn в браузере и PWA,
 * нативный плагин в Capacitor), «Забыли код?». Код-пароль — всегда запасной путь.
 */
export default function LockScreen() {
  const { unlock, lockedUntil, canBiometric, biometricsEnabled, unlockWithBiometrics, authenticateBiometric, disablePasscode } = useSecurity();
  const { resetAll } = useFinance();
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const [bioNote, setBioNote] = useState('');
  const cooling = now < lockedUntil;
  const biometric =
    canBiometric && biometricsEnabled
      ? async ({ silent = false } = {}) => {
          const result = await authenticateBiometric();
          if (result === 'ok') return unlockWithBiometrics();
          if (!silent) setBioNote(result === 'failed' ? 'Face ID не подтвердил личность — введите код' : 'Face ID отменён — введите код или нажмите значок ещё раз');
        }
      : undefined;

  useEffect(() => {
    if (!cooling) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [cooling]);

  // Face ID — сразу при появлении экрана, как в банковских приложениях.
  // Safari может потребовать нажатия: тогда тихо ждём касания значка Face ID.
  useEffect(() => {
    biometric?.({ silent: true });
  }, [canBiometric, biometricsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const seconds = Math.ceil((lockedUntil - now) / 1000);

  if (forgot) {
    return (
      <div
        className="fixed inset-0 z-[100] mx-auto flex max-w-md flex-col justify-center bg-canvas px-6 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Сброс код-пароля"
      >
        <h1 className="text-[22px] font-semibold tracking-tight">Забыли код-пароль?</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Код нельзя восстановить: данные хранятся только на этом устройстве. Можно удалить все данные приложения и начать заново — затем восстановите их из резервной копии JSON
          или выписки.
        </p>
        <button
          onClick={() => {
            resetAll();
            disablePasscode();
          }}
          className="pressable mt-6 h-14 w-full rounded-2xl bg-red-600 text-[16px] font-semibold text-white"
        >
          Удалить данные и сбросить код
        </button>
        <button onClick={() => setForgot(false)} className="mt-2 h-12 w-full text-[15px] font-semibold text-ink-soft">
          Отмена
        </button>
      </div>
    );
  }

  return (
    <PasscodeScreen
      testId="lock-screen"
      title="Введите код-пароль"
      subtitle={
        cooling ? `Слишком много попыток. Повторите через ${plural(seconds, ['секунду', 'секунды', 'секунд'])}` : bioNote || (biometric ? 'Face ID / Touch ID или код-пароль' : 'Приложение заблокировано')
      }
      disabled={cooling}
      onBiometric={biometric ? () => biometric() : undefined}
      onComplete={(code) => {
        const result = unlock(code);
        if (result === 'ok') return true;
        if (result === 'cooldown') {
          setNow(Date.now());
          return 'Слишком много попыток. Подождите 30 секунд';
        }
        return 'Неверный код-пароль';
      }}
      footer={
        <button onClick={() => setForgot(true)} className="text-[14px] font-semibold text-ink-muted active:text-ink">
          Забыли код?
        </button>
      }
    />
  );
}

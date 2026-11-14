import { useState } from 'react';
import { X } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext.jsx';
import PasscodeScreen from './PasscodeScreen.jsx';

/**
 * Включение и отключение код-пароля.
 * mode 'create': новый код → повтор; mode 'disable': текущий код.
 */
export default function PasscodeSetup({ mode, onDone, onCancel }) {
  const { setPasscode, disablePasscode, verify } = useSecurity();
  const [first, setFirst] = useState(null);

  const close = (
    <div className="flex justify-end px-4">
      <button onClick={onCancel} className="pressable grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-ink-soft" aria-label="Отмена">
        <X size={18} />
      </button>
    </div>
  );

  if (mode === 'disable') {
    return (
      <PasscodeScreen
        testId="passcode-setup"
        header={close}
        title="Текущий код-пароль"
        subtitle="Введите код, чтобы отключить защиту"
        onComplete={(code) => {
          if (!verify(code)) return 'Неверный код-пароль';
          disablePasscode();
          onDone('disabled');
          return true;
        }}
      />
    );
  }

  return (
    <PasscodeScreen
      testId="passcode-setup"
      header={close}
      resetKey={first ? 'confirm' : 'create'}
      title={first ? 'Повторите код-пароль' : 'Придумайте код-пароль'}
      subtitle={first ? 'Введите те же 4 цифры ещё раз' : '4 цифры — для входа в приложение'}
      onComplete={(code) => {
        if (!first) {
          setFirst(code);
          return true;
        }
        if (code !== first) {
          setFirst(null);
          return 'Коды не совпали. Начните заново';
        }
        setPasscode(code);
        onDone('enabled');
        return true;
      }}
    />
  );
}

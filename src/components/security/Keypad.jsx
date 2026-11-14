import { useEffect } from 'react';
import { Delete, ScanFace } from 'lucide-react';
import { haptic } from '../../utils/haptics.js';
import { PASSCODE_LENGTH } from '../../utils/passcode.js';

const KEYS = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
];

/** Точки ввода кода. */
export function PasscodeDots({ length, error = false }) {
  return (
    <div className={`flex justify-center gap-5 ${error ? 'animate-shake' : ''}`} aria-hidden="true" data-testid="passcode-dots">
      {Array.from({ length: PASSCODE_LENGTH }, (_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full border-[1.5px] transition-all duration-150 ${i < length ? (error ? 'scale-110 border-red-500 bg-red-500' : 'scale-110 border-ink bg-ink') : 'border-ink-muted'}`}
        />
      ))}
    </div>
  );
}

/**
 * Цифровая клавиатура в стиле iOS. Поддерживает и физическую клавиатуру
 * (цифры, Backspace) — удобно на iPad и в браузере на компьютере.
 */
export default function Keypad({ onDigit, onDelete, onBiometric, disabled = false, canDelete = true }) {
  useEffect(() => {
    const onKey = (e) => {
      if (disabled) return;
      if (/^\d$/.test(e.key)) {
        haptic('light');
        onDigit(e.key);
      } else if (e.key === 'Backspace') onDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDigit, onDelete, disabled]);

  const key = (digit, letters) => (
    <button
      key={digit}
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic('light');
        onDigit(digit);
      }}
      className="mx-auto grid h-[78px] w-[78px] place-items-center rounded-full bg-gray-100 transition-colors duration-75 active:bg-gray-300 disabled:opacity-40"
      aria-label={digit}
    >
      <span className="flex flex-col items-center leading-none">
        <span className="text-[32px] font-normal tracking-tight">{digit}</span>
        <span className="mt-1 h-2.5 text-[9px] font-semibold tracking-[0.2em] text-ink-muted">{letters}</span>
      </span>
    </button>
  );

  return (
    <div className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-x-6 gap-y-4" data-testid="keypad">
      {KEYS.map(([d, l]) => key(d, l))}
      {onBiometric ? (
        <button type="button" onClick={onBiometric} className="mx-auto grid h-[78px] w-[78px] place-items-center rounded-full text-ink active:bg-gray-100" aria-label="Face ID">
          <ScanFace size={30} strokeWidth={1.6} />
        </button>
      ) : (
        <span />
      )}
      {key('0', '')}
      <button
        type="button"
        onClick={() => {
          haptic('selection');
          onDelete();
        }}
        disabled={!canDelete || disabled}
        className="mx-auto grid h-[78px] w-[78px] place-items-center rounded-full text-ink transition-opacity active:bg-gray-100 disabled:opacity-0"
        aria-label="Стереть"
      >
        <Delete size={26} strokeWidth={1.6} />
      </button>
    </div>
  );
}

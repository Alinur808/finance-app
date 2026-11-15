import { Component } from 'react';
import { flushFinanceState } from '../context/FinanceContext.jsx';

/**
 * Последний рубеж: ошибка отрисовки не превращается в белый экран.
 * Данные уже сохранены в зашифрованном сейфе — предлагаем перезапуск.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch() {
    flushFinanceState().catch(() => {});
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-canvas px-6 text-ink" role="alert" data-testid="app-error">
        <p className="text-[22px] font-semibold tracking-tight">Что-то пошло не так</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Ваши данные в безопасности — они сохранены на устройстве. Перезапустите приложение.</p>
        <button onClick={() => window.location.reload()} className="pressable mt-6 h-14 w-full rounded-2xl bg-ink text-[16px] font-semibold text-on-ink">
          Перезапустить
        </button>
        <p className="mt-4 break-words font-mono text-[11px] text-ink-muted">{String(this.state.error?.message ?? this.state.error).slice(0, 200)}</p>
      </div>
    );
  }
}

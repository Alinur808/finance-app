import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter/wght.css'; // шрифт внутри сборки: работает офлайн и в Capacitor
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { FinanceProvider } from './context/FinanceContext.jsx';
import { SubscriptionProvider } from './context/SubscriptionContext.jsx';
import { SecurityProvider } from './context/SecurityContext.jsx';
import { installPrivacyCurtain } from './utils/privacyCurtain.js';
import { openBrowserVault } from './utils/vault.js';
import { setupAutoUpdate } from './pwa.js';
import './index.css';

// Шторка — раньше всего остального: суммы не попадают в переключатель приложений.
installPrivacyCurtain();

// Сейф расшифровывается до первой отрисовки (≈50 мс на телефоне), затем — приложение.
openBrowserVault().then((vault) => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ThemeProvider>
        <FinanceProvider vault={vault}>
          <SubscriptionProvider>
            <SecurityProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </SecurityProvider>
          </SubscriptionProvider>
        </FinanceProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
});

// Автообновление: только в PWA-сборке (в dev и в однофайловой сборке service worker нет).
if (import.meta.env.PROD && import.meta.env.MODE !== 'single') setupAutoUpdate();

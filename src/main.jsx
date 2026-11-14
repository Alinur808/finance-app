import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter/wght.css'; // шрифт внутри сборки: работает офлайн и в Capacitor
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { FinanceProvider } from './context/FinanceContext.jsx';
import { SubscriptionProvider } from './context/SubscriptionContext.jsx';
import { SecurityProvider } from './context/SecurityContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <FinanceProvider>
        <SubscriptionProvider>
          <SecurityProvider>
            <App />
          </SecurityProvider>
        </SubscriptionProvider>
      </FinanceProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

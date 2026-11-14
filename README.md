# Финансы: personal finance PWA

This is a mobile-first finance app built with React 18, Tailwind CSS 3 and Vite 6. The UI is in Russian and amounts are in tenge (₸). It loads your Kaspi Gold statement and installs to the iPhone home screen as a PWA.

## Commands
```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # PWA build with your statement data → dist/
npm run build:public   # PWA build with NO bank data, safe to host publicly
npm run build:single   # one self-contained dist/index.html (no service worker)
npm run preview        # serve dist/ on your LAN (for testing on the phone)
npm run icons          # re-render PNG icons from public/icon.svg
npm run test:unit      # statement engine unit tests (node --test)
npm run test:e2e       # Playwright suite on a 390×844 mobile viewport (builds build:public first)
npm run fixtures       # regenerate the synthetic bank PDFs used by the tests (needs python3 + reportlab)
```

## Updating the statement
```bash
npm run import-statement -- path/to/gold_statement.pdf --balance 265568.92
```
The script `scripts/parse_kaspi_statement.py` needs `pdftotext` (poppler-utils). It parses every row of the English Kaspi Gold statement and assigns categories using the merchant rules at the top of the script. It checks that the rows reconcile with the statement's opening and closing balances, then writes `src/data/statement.json`. The `--balance` flag sets the opening balance so the app shows exactly that current balance.

**`src/data/statement.json` contains your bank data.** It holds your transactions and the names of people you sent money to or received money from, so it is listed in `.gitignore` and never goes to GitHub. When the file is missing (on GitHub Actions, or in a fresh clone), every build uses an empty statement instead.

## First run
A new visitor sees three choices: import a Freedom Bank PDF, restore a JSON backup, or start from scratch by entering the current card balance (plus optional card name and first name). There is no preset demo data, goal or budget. «Профиль → Начать заново» returns the device to this screen.

## Importing bank statements (PDF, any bank)
**Профиль → Импорт данных** (or the start screen) accepts a PDF statement from any bank, or a JSON backup. Everything is parsed in the browser with pdf.js; the file never leaves the device. `src/utils/statementParser.js` picks the parser automatically:

1. **Dedicated parsers.** Freedom Bank (`freedomParser.js`, unchanged), Kaspi Gold (`kaspiParser.js`: `DD.MM.YY` dates, `- 12 450,00 ₸` amounts, wrapped details, `(- 9,99 USD)` lines, card `*1234`, closing balance from «Доступно на …») and Halyk Bank (`halykParser.js`: transaction and posting dates, «Приход/Расход в валюте счёта», operation currency, a separate bank-fee row). A bank is recognised only from the header above the first transaction, so «Перевод на Kaspi» inside another bank's statement doesn't switch parsers.
2. **Universal table parser** (`universalStatementParser.js`) for every other bank (ForteBank, Jusan, BCC, Revolut, Wise, Emirates NBD, Wio, …). It rebuilds lines and cells from pdf.js coordinates, finds the header (Дата/Date, Описание/Description, Сумма/Amount, Расход/Debit/Money out, Приход/Credit/Money in, Остаток/Balance, Валюта/Currency) or, without one, clusters the amount columns. Dates: `DD.MM.YYYY`, `DD.MM.YY`, `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY` (decided per document), `14 Nov 2026`, `Nov 14, 2026`, `14 ноября 2026`. Amounts: `+`/`-` before or after, `(250.00)`, `CR`/`DR`, separate debit/credit columns, `1 234,56` and `1,234.56`, `₸ KZT $ USD AED € EUR ₽ RUB £ GBP`. When the sign isn't printed, it comes from the running balance, then from keywords. Wrapped descriptions are attached to their row; page headers, page numbers, QR/verification footers and totals (Итого, Всего, Total, Opening/Closing balance) are skipped.
3. **Shared logic.** `categorizer.js` classifies Russian and English descriptions into the app's existing category ids (`food` → `groceries`, `transport` → `taxi`, `internal` → `own` «Между своими счетами», `other` → `shopping`). Moves to and from your own deposits (Kaspi Депозит, savings, vaults) are internal: they change the balance but not income or spending. Statements in a foreign currency with no printed rate are converted with the reference rates in `fxRates.js` (AED 125, USD 459,06, EUR 540, GBP 615, RUB 5,5 ₸); the original amount is kept on each transaction, and the confirmation sheet shows the rate used.

Importing replaces the main card's transactions only for the statement's period and sets the card balance to the statement's closing balance (if the statement has none, the balance moves by the imported operations). Cash, other months, goals and the Financial Diary plan are kept, and a custom card name is never overwritten. A PDF without a text layer (a scan or photo) gets a clear message asking for the official PDF from the bank's app.

**Safari / iOS:** pdf.js 6 reads text with `for await` over a `ReadableStream`, which WebKit doesn't support, and calls `Promise.withResolvers`, which iOS before 17.4 lacks. The app reads text with a manual `streamTextContent().getReader()` loop (`readTextContent` in `freedomParser.js`) and installs polyfills for both APIs (`src/utils/pdfCompat.js`) on the page and inside the worker (`src/workers/pdf.worker.js`). The pdf.js worker is bundled by Vite (`?worker`) as an ordinary `.js` file and passed through `GlobalWorkerOptions.workerPort`. Import errors show a plain message plus the exact technical cause with a copy button.

## Deploying to GitHub Pages
GitHub Pages only serves ready-made files and can't run Vite. The workflow in `.github/workflows/deploy.yml` builds the app on every push to `main` and publishes `dist/`.

1. One-time setup: in the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
2. Push to `main`. The build takes about a minute; you can watch it in the **Actions** tab.
3. The site is published at `https://alinur808.github.io/finance-app/`.

The workflow runs `npm run build:public`, so the published site contains no bank data. `vite.config.js` uses `base: './'`, so every path (scripts, icons, `manifest.json`, `sw.js`) is relative and works from the `/finance-app/` sub-folder.

## Installing on iPhone (PWA)
1. Open `https://alinur808.github.io/finance-app/` in Safari, tap **Share**, then **Add to Home Screen**. The app opens full-screen without the Safari interface and works offline.
2. In the app, go to **Профиль → Импорт данных** and choose a backup exported from your local build. That loads your transactions, goals and balance on the phone.

## Design system: Obsidian & Alabaster
Colours are CSS variables in `src/index.css` (`R G B` triplets), mapped in `tailwind.config.js`, so the same classes (`bg-surface`, `text-ink-muted`, `bg-red-50`…) work in both themes. **Obsidian** (default) is an OLED dark theme: `#050507` canvas, `#0E1015` surfaces, 8 % white hairlines, emerald `#10B981` for income and coral for spending. **Alabaster** is the daylight theme. The theme lives in `localStorage['tenge-finance.theme']` (device preference, not part of backups); an inline script in `index.html` applies it before first paint. Inter is self-hosted (`@fontsource-variable/inter`), so it works offline and inside Capacitor. All numbers use tabular figures; balances use `FitText`, which shrinks the font so anything from `0 ₸` to `999 999 999 999 ₸` fits on one line.

## Privacy & security
- **Stealth Mode** — the eye on the balance card (or Профиль → Приватность). Every amount on Обзор, Аналитика and Планы becomes `•••••• ₸`; charts stay usable. It reuses the existing `settings.hideBalance` flag, so old data and backups work unchanged (`src/hooks/usePrivacy.js`).
- **Passcode Lock** — Профиль → Защита код-паролем (Private). Locks on cold open and whenever the app goes to the background (`visibilitychange`); system pickers (file import, share sheet) pause auto-lock. Only a salted, iterated SHA-256 hash is stored (`localStorage['tenge-finance.security']`), never in backups. Five wrong attempts → 30 s cooldown. «Забыли код?» offers a full device reset. Face ID / Touch ID: install a Capacitor plugin with the `capacitor-native-biometric` API and the lock screen shows the Face ID button automatically (`src/native/biometrics.js`).

## Membership (Standard / Private)
`src/context/SubscriptionContext.jsx` gates features; plans and limits live in `src/data/membership.js`.

| | Standard (free) | Private |
|---|---|---|
| Manual tracking, analytics, cash-flow chart, Stealth Mode | ✓ | ✓ |
| First Freedom PDF import (and re-importing the same period) | ✓ | ✓ |
| Strategist insights | 2 | unlimited |
| AI capital review (Claude, own API key) | — | ✓ |
| Statements for several periods | — | ✓ |
| Financial Diary goals | 3 | unlimited |
| Passcode Lock | — | ✓ |

Limits never delete existing data: users who already have more diary goals keep them, and an existing passcode keeps working after a downgrade. In the web build, «Режим подписки (Preview)» in Профиль switches tiers and «purchases» activate Private locally without charging. In Capacitor, install `@revenuecat/purchases-capacitor`, call `configureBilling({ apiKey })` from `src/native/billing.js` at startup, and create products `private_monthly`, `private_annual`, `private_lifetime` attached to the entitlement `private`. The preview toggle hides itself once the store plugin is present.

## Native packaging (Capacitor)
`dist/` is ready to wrap: paths are relative (`base: './'`), fonts are bundled, and native features (haptics, biometrics, purchases) are looked up at runtime through `window.Capacitor.Plugins` (`src/native/bridge.js`), so the web build has no native dependencies. `capacitor.config.json` is a starting point; change `appId` to your own bundle id before the first `cap add`.
```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/haptics
npm run build:public && npx cap add ios && npx cap add android && npx cap sync
```

## Tests
`npm run fixtures` generates synthetic statements, all with invented data: Freedom (208 rows, 14 234,77 ₸), Kaspi Gold (120 rows, 87 412,35 ₸, Kaspi Депозит moves, USD lines, split amounts, wrapped details), Halyk (64 rows + 16 fee rows), Emirates NBD in AED (58 rows, universal parser), and an image-only "scan".

- `npm run test:unit` checks number/date formats, the categorizer, the universal parser on Revolut-, ForteBank-, US- and Wio-style layouts, and every fixture PDF through pdf.js.
- `npm run test:e2e` runs Playwright on a 390×844 viewport with an iPhone user agent. It covers billion-scale balances, Stealth Mode, themes, the paywall, Passcode Lock, cash-flow scrubbing, 16 px inputs, legacy data and JSON import. It also imports every bank's PDF while simulating iOS Safari: `Promise.withResolvers` and the `ReadableStream` async iterator are deleted on the page and inside the pdf.js worker. Further checks: the merge rules, the FX-rate confirmation and the scanned-PDF message.

To check your own statements:
```bash
FREEDOM_PDF=~/Downloads/freedom.pdf FREEDOM_ROWS=208 FREEDOM_BALANCE="14 234,77" KASPI_PDF=~/Downloads/kaspi.pdf KASPI_ROWS=… KASPI_BALANCE="…" npm run test:e2e
```

## Structure
```
src/
  data/        categories (pastel icon colours), accounts, statement.json, seed loader
  utils/       dates/periods (ru), money formatting (ru), analytics, advisor, backup,
               statement engine: statementParser, freedom/kaspi/halyk parsers, universalStatementParser, categorizer, fxRates
  context/     FinanceContext (reducer + localStorage), Theme, Subscription, Security
  components/  BalanceCard, CashflowChart, FilterChips, TransactionList, sheets, goals/*, security/*, membership/*
  native/      Capacitor bridges: haptics lookup, biometrics, RevenueCat billing
  screens/     Overview, Analytics, Goals, Profile
scripts/       parse_kaspi_statement.py, make-icons.cjs
tests/         e2e/*.spec.js (Playwright), fixtures/ (synthetic data and PDF generator)
```

## Advisor (`src/utils/advisor.js`)
- `buildAdvice()` is rule-based. It averages cash flow over the last 60 days, or over the available data if there is less. It compares how many weeks the goal will take with the weeks left before the deadline. It ranks quantified tips: the top flexible category, food delivery, taxi vs metro, small purchases, transfer fees, the 50/30/20 savings rate, and "pay yourself first".
- `buildTelemetry()` (`src/utils/telemetry.js`) feeds «Главные цифры» on Планы: «Расход в месяц» (and per day), «Откладываете» (share of income saved), «Запас денег» (days the balance lasts at the current spending) and «Главная статья» (largest category's share), over the same 60-day window. All user-facing copy is plain Russian — no banking jargon or English terms.
- `getAIAdvice()` is the LLM hook (Private). When an API key is saved in Профиль, the Goals screen shows «ИИ-разбор капитала». The button sends the goal, the monthly summary and the transactions from the last 60 days to Claude (`claude-opus-5-5`) through `@anthropic-ai/sdk` from the browser. Server-side refusal fallbacks are enabled. The OpenAI path is a TODO stub. The key lives only in localStorage and is never included in exports. For anything beyond personal use, move this call to a server.

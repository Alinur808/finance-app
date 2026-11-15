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
Colours are CSS variables in `src/index.css` (`R G B` triplets), mapped in `tailwind.config.js`, so the same classes (`bg-surface`, `text-ink-muted`, `bg-red-50`…) work in both themes. **Obsidian** (default) is an OLED dark theme: `#050507` canvas, `#0E1015` surfaces, 8 % white hairlines, emerald `#10B981` for income and coral for spending. **Alabaster** is the daylight theme. The theme lives in `localStorage['tenge-finance.theme']` (device preference, not part of backups); `public/boot.js` applies it before first paint. Inter is self-hosted (`@fontsource-variable/inter`), so it works offline and inside Capacitor. All numbers use tabular figures; balances use `FitText`, which shrinks the font so anything from `0 ₸` to `999 999 999 999 ₸` fits on one line.

## Privacy & security
- **Encryption at rest** (`src/utils/vault.js`). The whole app state lives in `localStorage['tenge-finance.vault']`, encrypted with AES-GCM-256. The key is derived with PBKDF2-SHA-256 (120 000 iterations) from a random 256-bit device secret that is stored separately, in IndexedDB (`tenge-finance-keys`); only if IndexedDB is unavailable does it fall back to localStorage (the record's `ks` field says which). Every save uses a fresh 12-byte IV and authenticated context data. `main.jsx` opens the vault before the first render. Old plaintext data (`tenge-finance.v2`) is encrypted on first launch, re-read and compared, and only then deleted, so no transaction is lost. A vault that cannot be decrypted is never overwritten: the app shows a notice and saves nothing until the user chooses «Начать заново». Over plain http on a LAN (no Web Crypto) the app keeps the old unencrypted format. Scope: this protects data at rest (storage inspection, profile dumps); it can't protect against code already running on the page, which is why the passcode, Face ID and the privacy curtain exist.
- **Privacy curtain** (`src/utils/privacyCurtain.js`). On `blur`, `pagehide` and `visibilitychange → hidden`, a class on `<html>` shows an opaque Obsidian layer synchronously, inside the event handler, so the iOS/Android app switcher snapshot never shows balances.
- **Content-Security-Policy.** Builds get a strict `<meta http-equiv="Content-Security-Policy">` (`vite.config.js`): `script-src 'self'` (no inline scripts, no eval), `worker-src 'self' blob:` for pdf.js, `connect-src 'self' https://api.anthropic.com`, `object-src 'none'`. The theme script moved to `public/boot.js`, which also hides the app when it's framed (GitHub Pages can't send `frame-ancestors`). Dev mode has no CSP because Vite HMR needs inline scripts.
- **Input sanitizing** (`src/utils/sanitize.js`). `?quickAdd=` link parameters, PDF merchant names and JSON backups go through allow-lists. Control, zero-width and bidi characters and angle brackets are stripped, lengths are capped, amounts must be finite and positive, and unknown keys are dropped, including `__proto__`. Links never save anything without a tap.
- **AI key isolation** (`src/utils/secrets.js`). The optional beta API key lives only in `sessionStorage`. It is never written to the vault, localStorage or exports, and it is gone when the app closes. Keys saved by older versions are moved there on first launch.
- **Stealth Mode**: the eye on the balance card. Every amount on Обзор, Аналитика and Планы becomes `•••••• ₸`, including all new cards; percentages and charts stay (`src/hooks/usePrivacy.js`, the existing `settings.hideBalance` flag).
- **Passcode Lock + Face ID / Touch ID** are free in Standard. The 4-digit code is stored as a salted, iterated SHA-256 hash (`localStorage['tenge-finance.security']`, never in backups); five wrong attempts → 30 s cooldown. Face ID works in mobile Safari and Chrome PWAs today through **WebAuthn** (`src/utils/webauthn.js`): a platform passkey with `userVerification: 'required'`. Unlocking checks the challenge, origin, UV flag and the ES256/RS256 signature locally, with no server. The PIN is always the fallback. In Capacitor, the native plugin (`src/native/biometrics.js`) is used instead.

## Plans: «Цель и темп трат»
The Планы tab has two pills instead of two long stacked sections:
- **Цель и дневник** has one hero card with the active goal's progress, «Сегодня можно потратить X ₸», the projected completion date and a status badge (`src/utils/pace.js`: the Financial Diary's daily limit when a plan exists, otherwise income − required goal savings − month-to-date spending, spread over the rest of the month). Below it come «Эта неделя» (spending since Monday, the optional **Недельный лимит трат**, «Итоги недели») and a compact Financial Diary.
- **Анализ и профиль** holds «Что приложение знает обо мне», Главные цифры, the Strategist (with «Что изменилось»: month-over-month deltas and anomalies) and multi-currency capital.

## Tester features
- **Percentages for every category**: Top Spending (with «Все категории») and Analytics. `formatShare` shows one decimal below 10 %.
- **Voice input** (`src/hooks/useSpeech.js`, `src/utils/voiceParser.js`). The mic button in «Новая операция» uses Web Speech `ru-RU`. «Такси две пятьсот» → 2 500 ₸ Транспорт, «Кофе 1800», «Зарплата 300 тысяч», «полторы тысячи», «300к». Standard allows 3 phrases a day.
- **«Стоит ли оно того?»** (`src/utils/worthIt.js`). Under the amount: «≈ 4,5 часа работы». The hourly rate is auto-estimated from income (salary first) ÷ 168 h, or set with a 1-tap popover. Private adds «отложит цель на +N дней» and a simulator in Планы (one-off, weekly, monthly).
- **Behavioral DNA** (`src/utils/userProfileAnalyzer.js`): peak weekday, weekend share, late-night spending (PDF rows without a real time are ignored), small purchases under 3 000 ₸, recurring payments, archetype, traits and 3 actions with ₸/month impact. Standard sees a teaser.
- **Weekly recap and guardrail** (`src/utils/weekly.js`). «Итоги недели» appears on Обзор on Sunday and Monday (dismissible) and is always available in Планы. When the weekly limit is reached, the banner reads «Лимит недели исчерпан — траты остановлены», and a new expense needs confirmation.
- **Apple Pay automation**. Профиль → «Автоматизация Apple Pay (Команды iOS)» copies the live link `…/?quickAdd=1&type=expense&amount=&merchant=` and shows a 3-step guide. The link opens a pre-filled sheet; nothing is saved without a tap.

## PWA auto-update
The service worker (`vite-plugin-pwa`, workbox) calls `skipWaiting()` and `clientsClaim()` and cleans outdated caches. `src/pwa.js` registers it, checks for updates on every return to the app and every 30 minutes, and on `controllerchange` silently reloads after flushing the encrypted save. It waits while a sheet is open, so a half-typed transaction is never lost. Testers get each push to `main` without clearing caches. The very first update after this release is picked up on the next app launch, because the previously installed version had no reload hook.

## Membership (Standard / Private)
`src/context/SubscriptionContext.jsx` gates features; plans, the four Private pillars, limits and the comparison table live in `src/data/membership.js`.

| | Standard (free) | Private |
|---|---|---|
| Manual tracking, PDF import for all banks, categories with %, «Сегодня можно потратить» | ✓ | ✓ |
| Passcode + Face ID, Stealth Mode, weekly recap and limit | ✓ | ✓ |
| «Что приложение знает обо мне» | teaser | full portrait + subscription leak radar |
| «Стоит ли оно того?» | work hours | + goal delay, what-if, yearly habit cost |
| AI analyst: month-over-month, anomalies, Claude review | — | ✓ |
| Voice input | 3 / day | unlimited |
| Strategist insights | 2 | unlimited |
| Statement archive (several periods) | 1 period | unlimited |
| Multi-currency capital ($, €, AED) | — | ✓ |
| Financial Diary goals | 3 | unlimited |

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
- `npm run test:unit` also covers the vault (encryption, migration, no overwrite of an unreadable vault), sanitizing, the voice parser, «Стоит ли оно того?», the behavior analyzer, weekly recap and limit, safe-to-spend, month-over-month and anomalies, and WebAuthn signature verification (`tests/unit/upgrade.test.js`).
- `tests/e2e/upgrade.spec.js` checks the plaintext → encrypted migration (decrypting the vault in the page), the CSP with zero violations including PDF import, real WebAuthn registration and unlock through Chromium's virtual authenticator with PIN fallback, the Plans layout, Stealth Mode on every new card, voice input (mocked recognition), Worth It, the Sunday recap and weekly guardrail, `?quickAdd=` sanitizing with no auto-commit, the Shortcuts link, the privacy curtain, AI key isolation, category percentages, and the service-worker reload that waits for an open sheet.
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
               statement engine: statementParser, freedom/kaspi/halyk parsers, universalStatementParser, categorizer, fxRates,
               security: vault, sanitize, secrets, webauthn, privacyCurtain; features: pace, weekly, worthIt,
               voiceParser, userProfileAnalyzer
  context/     FinanceContext (reducer + encrypted vault), Theme, Subscription, Security
  components/  BalanceCard, CashflowChart, FilterChips, TransactionList, sheets, goals/*, security/*, membership/*
  native/      Capacitor bridges: haptics lookup, biometrics, RevenueCat billing
  screens/     Overview, Analytics, Goals, Profile
scripts/       parse_kaspi_statement.py, make-icons.cjs
tests/         e2e/*.spec.js (Playwright), fixtures/ (synthetic data and PDF generator)
```

## Advisor (`src/utils/advisor.js`)
- `buildAdvice()` is rule-based. It averages cash flow over the last 60 days, or over the available data if there is less. It compares how many weeks the goal will take with the weeks left before the deadline. It ranks quantified tips: the top flexible category, food delivery, taxi vs metro, small purchases, transfer fees, the 50/30/20 savings rate, and "pay yourself first".
- `buildTelemetry()` (`src/utils/telemetry.js`) feeds «Главные цифры» on Планы: «Расход в месяц» (and per day), «Откладываете» (share of income saved), «Запас денег» (days the balance lasts at the current spending) and «Главная статья» (largest category's share), over the same 60-day window. All user-facing copy is plain Russian — no banking jargon or English terms.
- `monthOverMonth()` and `detectAnomalies()` compare this month with the same days of last month by category and flag purchases at least 3× the category median (and at least 10 000 ₸). `describeChanges()` turns them into plain Russian for «Что изменилось».
- `getAIAdvice()` is the LLM hook (Private). When an API key is entered in Профиль, Планы → Анализ и профиль shows «ИИ-разбор капитала». The button sends the goal, the monthly summary, the month-over-month deltas, anomalies, a persona summary (archetype and traits, no names) and the transactions from the last 60 days to Claude (`claude-opus-5-5`) through `@anthropic-ai/sdk` from the browser. Server-side refusal fallbacks are enabled. The OpenAI path is a TODO stub. The key lives only in sessionStorage and is never included in exports. For anything beyond personal use, move this call to a server.

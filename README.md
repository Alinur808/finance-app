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
```

## Updating the statement
```bash
npm run import-statement -- path/to/gold_statement.pdf --balance 265568.92
```
The script `scripts/parse_kaspi_statement.py` needs `pdftotext` (poppler-utils). It parses every row of the English Kaspi Gold statement and assigns categories using the merchant rules at the top of the script. It checks that the rows reconcile with the statement's opening and closing balances, then writes `src/data/statement.json`. The `--balance` flag sets the opening balance so the app shows exactly that current balance.

**`src/data/statement.json` contains your bank data.** It holds your transactions and the names of people you sent money to or received money from, so it is listed in `.gitignore` and never goes to GitHub. When the file is missing (on GitHub Actions, or in a fresh clone), every build uses an empty statement instead.

## Importing a Freedom Bank statement (PDF)
In **Профиль → Импорт данных** (or on the empty start screen) you can choose a Freedom Bank Kazakhstan card statement (Super Card) as a PDF. It is parsed entirely in the browser with pdf.js (`src/utils/freedomParser.js`), and the file is never uploaded anywhere.

- Rows are read by their position on the page, which handles details that wrap above and below the date line and rows split across two pages.
- AED amounts are converted to tenge using the rates printed in the statement itself ("Между своими счетами по курсу …"). USD uses the AED rate × 3.6725, since the dirham is pegged to the dollar. The original amount is kept and shown next to each transaction.
- Moves between your own accounts and deposits get the internal category "Между своими счетами". They change the balance but don't count as income or spending.
- Importing replaces the main card's transactions for the statement's period and sets the balance to the statement's closing balance. Cash, other months, goals and the plan are kept, so importing the same statement twice creates no duplicates.

## Deploying to GitHub Pages
GitHub Pages only serves ready-made files and can't run Vite. The workflow in `.github/workflows/deploy.yml` builds the app on every push to `main` and publishes `dist/`.

1. One-time setup: in the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
2. Push to `main`. The build takes about a minute; you can watch it in the **Actions** tab.
3. The site is published at `https://alinur808.github.io/finance-app/`.

The workflow runs `npm run build:public`, so the published site contains no bank data. `vite.config.js` uses `base: './'`, so every path (scripts, icons, `manifest.json`, `sw.js`) is relative and works from the `/finance-app/` sub-folder.

## Installing on iPhone (PWA)
1. Open `https://alinur808.github.io/finance-app/` in Safari, tap **Share**, then **Add to Home Screen**. The app opens full-screen without the Safari interface and works offline.
2. In the app, go to **Профиль → Импорт данных** and choose a backup exported from your local build. That loads your transactions, goals and balance on the phone.

## Structure
```
src/
  data/        categories (pastel icon colours), accounts, statement.json, seed loader
  utils/       dates/periods (ru), money formatting (ru), analytics, advisor, backup
  context/     FinanceContext: reducer + localStorage persistence
  components/  BalanceCard (Kaspi Gold card), FilterChips, TransactionList, charts, sheets, goals/*
  screens/     Overview, Analytics, Goals, Profile
scripts/       parse_kaspi_statement.py, make-icons.cjs
```

## Advisor (`src/utils/advisor.js`)
- `buildAdvice()` is rule-based. It averages cash flow over the last 60 days, or over the available data if there is less. It compares how many weeks the goal will take with the weeks left before the deadline. It ranks quantified tips: the top flexible category, food delivery, taxi vs metro, small purchases, transfer fees, the 50/30/20 savings rate, and "pay yourself first".
- `getAIAdvice()` is the LLM hook. When an API key is saved in Профиль, the Goals screen shows a «Совет от ИИ» button. The button sends the goal, the monthly summary and the transactions from the last 60 days to Claude (`claude-opus-5-5`) through `@anthropic-ai/sdk` from the browser. Server-side refusal fallbacks are enabled. The OpenAI path is a TODO stub. The key lives only in localStorage and is never included in exports. For anything beyond personal use, move this call to a server.

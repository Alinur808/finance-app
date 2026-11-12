#!/usr/bin/env python3
"""
Convert a Kaspi Gold PDF statement (English version) into src/data/statement.json.

Usage:
    python3 scripts/parse_kaspi_statement.py path/to/gold_statement.pdf [--balance 265568.92]

Needs `pdftotext` (poppler-utils). Every row is categorised by merchant rules
below; unknown merchants fall back to "shopping". The script checks that the
parsed rows add up to the statement's own opening/closing balances.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROW = re.compile(
    r"^\s*(\d{2})\.(\d{2})\.(\d{2})\s+([-+])\s*([\d\s]+,\d{2})\s*₸\s+"
    r"(Purchases|Transfers|Replenishment|Others|Withdrawals)\s+(.*?)\s*$"
)
FOREIGN = re.compile(r"^\s*\(([-+])\s*([\d\s]+,\d{2})\s+([A-Z]{3})\)\s*$")
BALANCE = re.compile(r"Card balance (\d{2}\.\d{2}\.\d{2})\s+([-+])\s*([\d\s]+,\d{2})\s*₸")

# (regex on merchant, category id) - first match wins
MERCHANT_RULES = [
    (r"talabat|keeta|careem deliveries", "delivery"),
    (r"careem quik|noon minutes|habeeb|qiso|spinneys|grocery|supermarket|fresh market|gmg consumer|blue box vending|enoc", "groceries"),
    (r"mcdonald|tannoureen|serrano|kausar|slaw|starbucks|raising cane|find salt|restaura", "cafe"),
    (r"taxi", "taxi"),
    (r"apple\.com|anthropic|claude", "subscriptions"),
    (r"gamerstore|godji|game", "entertainment"),
]


def money(s):
    return round(float(s.replace(" ", "").replace(" ", "").replace(",", ".")), 2)


def categorize(kind, sign, merchant, fx):
    if fx:
        return "fx"
    if kind == "Replenishment":
        return "topup"
    if kind == "Transfers":
        return "transfers"
    if kind == "Others":
        return "fees"
    if kind == "Withdrawals":
        return "cash"
    if kind == "Purchases" and sign == "+":
        return "refunds"
    m = merchant.lower()
    for pattern, cat in MERCHANT_RULES:
        if re.search(pattern, m):
            return cat
    return "shopping"


def clean_merchant(kind, merchant):
    merchant = re.sub(r"\s{2,}", " ", merchant).strip()
    if kind == "Others" and "Commission" in merchant:
        return "Комиссия за перевод в другой банк"
    if merchant == "From card of other banks":
        return "С карты другого банка"
    merchant = merchant.replace("To card ", "На карту ")
    return merchant


def parse(text):
    lines = text.splitlines()
    rows, balances = [], {}
    for line in lines:
        b = BALANCE.search(line)
        if b:
            balances[b.group(1)] = money(b.group(3)) * (1 if b.group(2) == "+" else -1)
    for i, line in enumerate(lines):
        m = ROW.match(line)
        if not m:
            continue
        dd, mm, yy, sign, amount, kind, merchant = m.groups()
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        fx = "Foreign exchange difference" in nxt
        foreign = FOREIGN.match(nxt)
        rows.append({
            "day": f"20{yy}-{mm}-{dd}",
            "type": "income" if sign == "+" else "expense",
            "amount": money(amount),
            "kind": kind,
            "categoryId": categorize(kind, sign, merchant, fx),
            "merchant": clean_merchant(kind, merchant),
            **({"original": {"amount": money(foreign.group(2)), "currency": foreign.group(3)}} if foreign else {}),
        })
    return rows, balances


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--balance", type=float, default=None, help="current balance to show in the app")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "src/data/statement.json"))
    args = ap.parse_args()

    text = subprocess.run(["pdftotext", "-layout", args.pdf, "-"], capture_output=True, text=True, check=True).stdout
    rows, balances = parse(text)
    if not rows:
        sys.exit("No transactions found - is this an English Kaspi Gold statement?")

    net_cents = sum(round(r["amount"] * 100) * (1 if r["type"] == "income" else -1) for r in rows)
    (start_key, start_bal), (end_key, end_bal) = sorted(balances.items(), key=lambda kv: kv[0][6:] + kv[0][3:5] + kv[0][:2])
    if round(start_bal * 100) + net_cents != round(end_bal * 100):
        sys.exit(f"Rows don't reconcile: {start_bal} + {net_cents / 100} != {end_bal}")

    target = args.balance if args.balance is not None else end_bal
    opening = (round(target * 100) - net_cents) / 100

    # Statement lists newest first; keep that order within a day via `seq`.
    for seq, r in enumerate(rows):
        r["seq"] = len(rows) - seq
        r.pop("kind")

    out = {
        "source": "Kaspi Gold statement",
        "period": {"from": rows[-1]["day"], "to": rows[0]["day"]},
        "statementClosingBalance": end_bal,
        "openingBalance": opening,
        "transactions": rows,
    }
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))
    by_cat = Counter()
    for r in rows:
        by_cat[(r["type"], r["categoryId"])] += r["amount"]
    print(f"{len(rows)} rows, {out['period']}, reconciles {start_bal} -> {end_bal}; opening for app = {opening}")
    for (t, c), v in sorted(by_cat.items(), key=lambda kv: -kv[1]):
        print(f"  {t:8} {c:14} {v:12,.2f}")


if __name__ == "__main__":
    main()

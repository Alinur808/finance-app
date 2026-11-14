#!/usr/bin/env python3
"""
Синтетическая выписка Freedom Bank (Super Card) для e2e-теста импорта PDF.

Повторяет раскладку настоящей выписки, на которую рассчитан
src/utils/freedomParser.js: шапка «Фридом Банк / Выписка по карте … за период»,
остатки «KZ… KZT 14,234.77 ₸», таблица «Дата | Сумма | Валюта | Операция | Детали»
на нескольких страницах. Все операции и названия вымышлены.

    python3 tests/fixtures/make_freedom_fixture.py [out.pdf]

Нужны reportlab и шрифт DejaVu Sans (кириллица и знак ₸).
"""
import random
import sys
from datetime import date, timedelta

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROWS = 208
CLOSING = 14234.77
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tests/fixtures/freedom-synthetic.pdf'

pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
random.seed(42)

MERCHANTS = [
    ('Покупка', '-', 'MAGNUM CASH&CARRY ALMATY KZ', 9800),
    ('Покупка', '-', 'YANDEX GO ALMATY KZ', 1900),
    ('Покупка', '-', 'COFFEE BOOM ALMATY KZ', 2400),
    ('Покупка', '-', 'GLOVO ALMATY KZ', 5200),
    ('Покупка', '-', 'APPLE.COM/BILL ITUNES.COM IE', 3490),
    ('Перевод', '-', 'Перевод по номеру телефона. Получатель: Иван И. Назначение: подарок', 15000),
    ('Пополнение', '+', 'Пополнение с карты другого банка', 120000),
]


def money(v):
    return f'{v:,.2f}'


start = date(2026, 9, 1)
end = date(2026, 10, 31)
days = (end - start).days + 1
rows = []
for i in range(ROWS):
    op, sign, details, base = MERCHANTS[i % len(MERCHANTS)]
    amount = round(base * random.uniform(0.6, 1.4), 2)
    day = end - timedelta(days=int(i * days / ROWS))  # сверху — новее, как в банке
    rows.append((day.strftime('%d.%m.%Y'), f'{sign}{money(amount)} ₸', 'KZT', op, details))

c = canvas.Canvas(OUT, pagesize=A4)
W, H = A4
X_DATE, X_AMOUNT, X_CUR, X_OP, X_DETAILS = 40, 105, 200, 262, 360
ROW_H = 20
PER_PAGE = 32


def text(x, y, s, size=9):
    c.setFont('DejaVu', size)
    c.drawString(x, y, s)


def header_row(y):
    for x, s in ((X_DATE, 'Дата'), (X_AMOUNT, 'Сумма'), (X_CUR, 'Валюта'), (X_OP, 'Операция'), (X_DETAILS, 'Детали')):
        text(x, y, s, 9)


page_rows = [rows[i:i + PER_PAGE] for i in range(0, len(rows), PER_PAGE)]
for p, chunk in enumerate(page_rows):
    y = H - 50
    if p == 0:
        text(40, y, 'АО «Фридом Банк Казахстан» · bankffin.kz', 11)
        y -= 18
        text(40, y, f'Выписка по карте Super Card за период с {start.strftime("%d.%m.%Y")} по {end.strftime("%d.%m.%Y")}', 10)
        y -= 16
        text(40, y, 'Номер карты: **** 4242', 9)
        y -= 16
        text(40, y, 'Доступно на счетах:', 9)
        y -= 14
        text(40, y, 'KZ00551A000000004242', 9)
        text(200, y, 'KZT', 9)
        text(240, y, money(CLOSING), 9)
        text(300, y, '₸', 9)
        y -= 24
    header_row(y)
    y -= ROW_H
    for d, amount, cur, op, details in chunk:
        text(X_DATE, y, d)
        text(X_AMOUNT, y, amount)
        text(X_CUR, y, cur)
        text(X_OP, y, op)
        text(X_DETAILS, y, details[:42], 8)
        y -= ROW_H
    text(40, 30, f'Подлинность справки можно проверить на bankffin.kz · стр. {p + 1}', 7)
    c.showPage()
c.save()
print(f'{OUT}: {ROWS} rows, {len(page_rows)} pages, closing {money(CLOSING)} KZT')

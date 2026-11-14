#!/usr/bin/env python3
"""
Синтетические PDF-выписки для тестов движка выписок (все данные вымышлены):

  kaspi-synthetic.pdf    Kaspi Gold: ДД.ММ.ГГ, «- 12 450,00 ₸», переносы деталей,
                         суммы в валюте «(- 9,99 USD)», Kaspi Депозит, разбитые суммы
  halyk-synthetic.pdf    Halyk Bank: две даты, «Приход/Расход в валюте счёта», комиссия
  enbd-synthetic.pdf     Emirates NBD (универсальный разбор): DD Mon YYYY, Debit/Credit/
                         Balance, AED, многострочные описания, колонтитулы, итоги
  scanned-synthetic.pdf  «скан»: только графика, без текстового слоя

    python3 tests/fixtures/make_bank_fixtures.py [out_dir]

Ожидаемые значения (KASPI_*, HALYK_*, ENBD_*) продублированы в tests/e2e/statements.spec.js
и tests/unit/statements.test.js.
"""
import random
import sys
from datetime import date, timedelta

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = sys.argv[1] if len(sys.argv) > 1 else 'tests/fixtures'
pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
W, H = A4

KASPI_ROWS = 120
KASPI_CLOSING = 87412.35
HALYK_ROWS = 64
HALYK_CLOSING = 152300.40
ENBD_ROWS = 58
ENBD_CLOSING = 12345.67


def ru(v):
    """12450.5 → '12 450,50'"""
    return f'{v:,.2f}'.replace(',', ' ').replace('.', ',')


def en(v):
    return f'{v:,.2f}'


def text(c, x, y, s, size=8):
    c.setFont('DejaVu', size)
    c.drawString(x, y, s)


# ---------------------------------------------------------------- Kaspi Gold
def kaspi():
    random.seed(7)
    kinds = [
        ('Покупка', '-', 'Magnum Cash&Carry', 9800),
        ('Покупка', '-', 'Яндекс Go', 1900),
        ('Покупка', '-', 'Кофейня Coffee Boom', 2400),
        ('Перевод', '-', 'Айгерим А.', 15000),
        ('Покупка', '-', 'Glovo', 5200),
        ('Перевод', '-', 'На Kaspi Депозит', 50000),
        ('Пополнение', '+', 'С карты другого банка', 120000),
        ('Покупка', '-', 'APPLE.COM/BILL', 4590, ('- 9,99 USD',)),
        ('Покупка', '-', 'ИП Ахметов Магазин электроники и бытовой', 34990, ('техники, г. Алматы',)),
        ('Пополнение', '+', 'С Kaspi Депозита', 30000),
        ('Разное', '-', 'Комиссия за перевод в другой банк', 300),
        ('Снятие', '-', 'Банкомат Kaspi Bank', 20000),
        ('Перевод', '+', 'Данияр Б.', 8000),
        ('Покупка', '-', 'Аптека Europharma', 3100),
    ]
    end = date(2026, 10, 31)
    rows = []
    for i in range(KASPI_ROWS):
        k = kinds[i % len(kinds)]
        amount = round(k[3] * random.uniform(0.7, 1.3), 2) if k[2] != 'APPLE.COM/BILL' else 4590.0
        day = end - timedelta(days=int(i * 30 / KASPI_ROWS))
        rows.append((day, k[1], amount, k[0], k[2], k[4] if len(k) > 4 else ()))
    net = sum(a if s == '+' else -a for _, s, a, *_ in rows)
    opening = round(KASPI_CLOSING - net, 2)

    c = canvas.Canvas(f'{OUT}/kaspi-synthetic.pdf', pagesize=A4)
    XD, XA, XO, XT = 40, 92, 200, 285
    per_page = 30
    pages = [rows[i:i + per_page] for i in range(0, len(rows), per_page)]
    for p, chunk in enumerate(pages):
        y = H - 40
        if p == 0:
            for line, size in (
                ('АО «Kaspi Bank», БИК CASPKZKA, www.kaspi.kz', 8),
                ('ВЫПИСКА', 12),
                ('по Kaspi Gold за период с 01.10.26 по 31.10.26', 10),
                ('Иван Тестов', 9),
                ('Номер карты: *4242', 9),
                ('Номер счета: KZ00722S000000004242', 9),
                ('Валюта счета: тенге', 9),
            ):
                text(c, 40, y, line, size)
                y -= 15
            text(c, 40, y, 'Доступно на 01.10.26', 9)
            text(c, 200, y, f'{"+" if opening >= 0 else "-"} {ru(abs(opening))} ₸', 9)
            y -= 15
            text(c, 40, y, 'Доступно на 31.10.26', 9)
            text(c, 200, y, f'+ {ru(KASPI_CLOSING)} ₸', 9)
            y -= 24
        for x, s in ((XD, 'Дата'), (XA, 'Сумма'), (XO, 'Операция'), (XT, 'Детали')):
            text(c, x, y, s, 9)
        y -= 18
        for n, (day, sign, amount, op, details, extra) in enumerate(chunk):
            text(c, XD, y, day.strftime('%d.%m.%y'))
            if n % 4 == 1:  # pdf.js часто отдаёт знак, число и ₸ отдельными кусками
                text(c, XA, y, sign)
                text(c, XA + 6, y, ru(amount))
                text(c, XA + 6 + len(ru(amount)) * 4.6 + 2, y, '₸')
            else:
                text(c, XA, y, f'{sign} {ru(amount)} ₸')
            text(c, XO, y, op)
            text(c, XT, y, details)
            y -= 12
            for line in extra:
                if line.startswith(('-', '+')):
                    text(c, XA, y, f'({line})')
                else:
                    text(c, XT, y, line)
                y -= 12
            y -= 4
        text(c, 40, 28, 'АО «Kaspi Bank», www.kaspi.kz', 7)
        text(c, W / 2 - 20, 28, f'стр. {p + 1} из {len(pages)}', 7)
        c.showPage()
    c.save()
    print(f'kaspi: {KASPI_ROWS} rows, closing {KASPI_CLOSING}')


# ---------------------------------------------------------------- Halyk
def halyk():
    random.seed(11)
    kinds = [
        ('Покупка MAGNUM ALMATY', 'KZT', 8800, 'debit', 0),
        ('Покупка YANDEX.GO', 'KZT', 2100, 'debit', 0),
        ('Перевод на карту другого банка', 'KZT', 25000, 'debit', 150),
        ('Зачисление заработной платы ТОО Тест', 'KZT', 420000, 'credit', 0),
        ('Покупка NETFLIX.COM', 'USD', 9.99, 'debit', 0),
        ('Пополнение депозита Halyk', 'KZT', 60000, 'debit', 0),
        ('Покупка АПТЕКА ЖИВИКА', 'KZT', 4200, 'debit', 0),
        ('Снятие наличных АТМ HALYK', 'KZT', 30000, 'debit', 200),
    ]
    start = date(2026, 10, 1)
    rows = []
    for i in range(HALYK_ROWS):
        desc, cur, base, side, fee = kinds[i % len(kinds)]
        amount = base if cur != 'KZT' else round(base * random.uniform(0.8, 1.2), 2)
        kzt = round(amount * 459.0, 2) if cur == 'USD' else amount
        day = start + timedelta(days=int(i * 30 / HALYK_ROWS))
        rows.append((day, desc, amount, cur, kzt, side, fee))
    net = sum((k if side == 'credit' else -k) - fee for _, _, _, _, k, side, fee in rows)
    opening = round(HALYK_CLOSING - net, 2)

    c = canvas.Canvas(f'{OUT}/halyk-synthetic.pdf', pagesize=A4)
    cols = [(28, 'Дата', 'проведения'), (78, 'Дата', 'обработки'), (128, 'Описание', 'операции'), (290, 'Сумма', 'операции'), (345, 'Валюта', 'операции'), (392, 'Приход в', 'валюте счета'), (452, 'Расход в', 'валюте счета'), (515, 'Комиссия', '')]
    per_page = 28
    pages = [rows[i:i + per_page] for i in range(0, len(rows), per_page)]
    for p, chunk in enumerate(pages):
        y = H - 40
        if p == 0:
            for line, size in (
                ('АО «Народный Банк Казахстана» · Halyk Bank', 9),
                ('ВЫПИСКА ПО КАРТОЧНОМУ СЧЕТУ', 12),
                ('за период с 01.10.2026 по 31.10.2026', 9),
                ('Номер карты: 4400 43** **** 7788', 9),
                ('Валюта счета: KZT', 9),
                (f'Входящий остаток: {ru(opening)}', 9),
            ):
                text(c, 28, y, line, size)
                y -= 15
            y -= 8
        for x, a, b in cols:
            text(c, x, y, a, 7)
            if b:
                text(c, x, y - 9, b, 7)
        y -= 26
        for day, desc, amount, cur, kzt, side, fee in chunk:
            d = day.strftime('%d.%m.%Y')
            text(c, 28, y, d, 7)
            text(c, 78, y, d, 7)
            text(c, 128, y, desc[:30], 7)
            text(c, 290, y, ru(amount), 7)
            text(c, 345, y, cur, 7)
            text(c, 392 if side == 'credit' else 452, y, ru(kzt), 7)
            text(c, 515, y, ru(fee), 7)
            y -= 18
        if p == len(pages) - 1:
            text(c, 28, y - 6, f'Исходящий остаток: {ru(HALYK_CLOSING)}', 9)
        text(c, W / 2 - 25, 26, f'Страница {p + 1} из {len(pages)}', 7)
        c.showPage()
    c.save()
    fees = sum(1 for r in rows if r[6] > 0)
    print(f'halyk: {HALYK_ROWS} rows + {fees} fee rows, closing {HALYK_CLOSING}')


# ---------------------------------------------------------------- Emirates NBD (universal)
def enbd():
    random.seed(3)
    kinds = [
        ('POS PURCHASE CARREFOUR CITY CENTRE', 'MALL OF THE EMIRATES DUBAI', 'debit', 210),
        ('CAREEM RIDE', None, 'debit', 38),
        ('SALARY TRANSFER ACME TRADING LLC', None, 'credit', 9000),
        ('TALABAT ORDER', 'DUBAI MARINA', 'debit', 64),
        ('OWN ACCOUNT TRANSFER TO SAVINGS', None, 'debit', 1500),
        ('DEWA BILL PAYMENT', 'ONLINE BANKING', 'debit', 420),
        ('NETFLIX.COM SUBSCRIPTION', None, 'debit', 39),
        ('ATM CASH WITHDRAWAL', 'DUBAI MALL ATM', 'debit', 500),
    ]
    start = date(2026, 10, 2)
    rows = []
    for i in range(ENBD_ROWS):
        d1, d2, side, base = kinds[i % len(kinds)]
        rows.append((start + timedelta(days=int(i * 29 / ENBD_ROWS)), d1, d2, side, round(base * random.uniform(0.8, 1.2), 2)))
    net = sum(a if side == 'credit' else -a for _, _, _, side, a in rows)
    opening = round(ENBD_CLOSING - net, 2)

    c = canvas.Canvas(f'{OUT}/enbd-synthetic.pdf', pagesize=A4)
    XD, XS, XDR, XCR, XB = 36, 110, 360, 430, 500
    per_page = 22
    pages = [rows[i:i + per_page] for i in range(0, len(rows), per_page)]
    balance = opening
    for p, chunk in enumerate(pages):
        y = H - 40
        if p == 0:
            for line, size in (
                ('Emirates NBD Bank (P.J.S.C)', 12),
                ('Account Statement', 10),
                ('Account Number: 101XXXXXXX9876', 9),
                ('Statement Period: 01 Oct 2026 to 31 Oct 2026', 9),
                ('Currency: AED', 9),
            ):
                text(c, 36, y, line, size)
                y -= 15
            y -= 10
        for x, s in ((XD, 'Date'), (XS, 'Description'), (XDR, 'Debit'), (XCR, 'Credit'), (XB, 'Balance')):
            text(c, x, y, s, 9)
        y -= 18
        if p == 0:
            text(c, XD, y, '01 Oct 2026')
            text(c, XS, y, 'Opening Balance')
            text(c, XB, y, en(opening))
            y -= 18
        for day, d1, d2, side, amount in chunk:
            balance = round(balance + (amount if side == 'credit' else -amount), 2)
            text(c, XD, y, day.strftime('%d %b %Y'))
            text(c, XS, y, d1)
            text(c, XDR if side == 'debit' else XCR, y, en(amount))
            text(c, XB, y, en(balance))
            if d2:
                y -= 10
                text(c, XS, y, d2)
            y -= 16
        if p == len(pages) - 1:
            text(c, XS, y - 4, 'Closing Balance')
            text(c, XB, y - 4, en(ENBD_CLOSING))
        text(c, 36, 40, 'This is a computer generated statement and does not require a signature.', 7)
        text(c, W / 2 - 20, 26, f'Page {p + 1} of {len(pages)}', 7)
        c.showPage()
    c.save()
    assert abs(balance - ENBD_CLOSING) < 0.01
    print(f'enbd: {ENBD_ROWS} rows, closing AED {ENBD_CLOSING}')


# ---------------------------------------------------------------- «скан» без текста
def scanned():
    c = canvas.Canvas(f'{OUT}/scanned-synthetic.pdf', pagesize=A4)
    c.setFillGray(0.85)
    for i in range(30):
        c.rect(40, H - 80 - i * 22, 500, 12, fill=1, stroke=0)
    c.showPage()
    c.save()
    print('scanned: no text layer')


kaspi()
halyk()
enbd()
scanned()

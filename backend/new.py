#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Improved OCR-based PDF Statement Parser (Bank of America fix + sturdier Commonwealth)
- PyMuPDF renders each page to an image; Tesseract OCRs the image
- Strong, label-anchored extraction with issuer-specific heuristics
- Bank of America: prefer explicit "New Balance Total" and "Credit Limit / Credit Line" rows,
  choose the largest plausible amount near the label (avoid $0.00 noise)
- Avoid computing credit_limit from available_credit + new_balance if new_balance is zero/unknown

Fields:
  card_provider, available_credit, payment_due_date, new_balance, credit_limit

Usage:
  python ocr_card_parser.py file1.pdf file2.pdf --format csv
"""

import argparse
import io
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# ---------- OCR prerequisites ----------
# pip install pymupdf pillow pytesseract
# Also install Tesseract OCR on your system and ensure "tesseract" is on PATH.

# ---------- Imports ----------
import fitz  # PyMuPDF
from PIL import Image, ImageFilter, ImageOps, ImageEnhance
import pytesseract

# ---------- Rendering & OCR ----------

def _preprocess_for_ocr(img: Image.Image) -> List[Image.Image]:
    variants: List[Image.Image] = []
    g = img.convert("L")
    variants.append(g)

    v2 = ImageEnhance.Contrast(g).enhance(1.8)
    v2 = ImageEnhance.Brightness(v2).enhance(1.05)
    v2 = v2.filter(ImageFilter.UnsharpMask(radius=1, percent=170, threshold=3))
    variants.append(v2)

    v3 = g.point(lambda x: 255 if x > 180 else 0, mode="1").convert("L")
    variants.append(v3)

    v4 = ImageOps.invert(g)
    variants.append(v4)

    return variants


def _ocr_image(img: Image.Image, lang: str = "eng") -> str:
    texts = []
    for psm in (6, 4, 3):
        config = f"--oem 3 --psm {psm}"
        try:
            text = pytesseract.image_to_string(img, lang=lang, config=config) or ""
        except Exception:
            text = ""
        texts.append(text)
    return "\n".join(t for t in texts if t)


def ocr_pdf_to_text(path: str, dpi: int = 340) -> str:
    chunks: List[str] = []
    try:
        doc = fitz.open(path)
    except Exception:
        return ""
    for page in doc:
        mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        page_texts: List[str] = []
        for variant in _preprocess_for_ocr(img):
            page_texts.append(_ocr_image(variant))
        chunks.append("\n".join(page_texts))
    doc.close()

    text = "\n".join(chunks)
    text = unicodedata.normalize("NFKD", text or "")
    text = text.replace("\xa0", " ")
    text = re.sub(r"[·•●•]+", " ", text)
    text = re.sub(r"[\.]{2,}", " ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text


# ---------- Regex Patterns ----------

PROVIDERS: List[Tuple[str, List[re.Pattern]]] = [
    ("Bank of America", [
        re.compile(r"\bBank\s+of\s+America\b", re.I),
        re.compile(r"\bbankofamerica\.com\b", re.I),
        re.compile(r"\bBank\s*of\s*America,\s*N\.?A\.?\b", re.I),
        re.compile(r"\bBofA\b", re.I),
    ]),
    ("Chase", [
        re.compile(r"\bJPMorgan\s+Chase\b", re.I),
        re.compile(r"\bChase\s+Card\s+Services\b", re.I),
        re.compile(r"\bchase\.com\b", re.I),
        re.compile(r"\bChase\b(?!\w)", re.I),
    ]),
    ("American Express", [re.compile(r"\bAmerican\s+Express\b", re.I), re.compile(r"\bAMEX\b", re.I)]),
    ("Citi", [re.compile(r"\bCitibank\b", re.I), re.compile(r"\bCiti\s*Cards?\b", re.I), re.compile(r"\bCiti\b(?!\w)", re.I)]),
    ("Capital One", [re.compile(r"\bCapital\s+One\b", re.I), re.compile(r"\bcapitalone\.com\b", re.I)]),
    ("Commonwealth Bank", [
        re.compile(r"\bCommonwealth\s+Bank\s+of\s+Australia\b", re.I),
        re.compile(r"\bCommonwealth\s+Bank\b", re.I),
        re.compile(r"\bCommBank\b", re.I),
        re.compile(r"\bABN\s*48\s*123\s*123\s*124\b", re.I),
    ]),
]

AMOUNT_CORE = r"-?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2})?\)?"
AMOUNT = rf"(\$?\s*{AMOUNT_CORE})(?:\s*(?:CR|DR))?"
DATE_NUM = r"(\d{1,2}/\d{1,2}/\d{2,4})"
DATE_TEXT1 = r"([A-Za-z]{3,9}\s+\d{1,2},\s*\d{2,4})"
DATE_TEXT2 = r"(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})"
DATE_FINDER = re.compile(rf"{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2}")

# Global patterns
PATTERNS = {
    "available_credit": [
        re.compile(rf"(?mi)^\s*Available\s*(?:Credit|to\s*Spend|Funds|Balance|Credit\s*Line)\s+{AMOUNT}\b"),
        re.compile(rf"(?mis)\bAvailable\s*(?:Credit|to\s*Spend|Funds|Balance|Credit\s*Line)\b.*?{AMOUNT}"),
        re.compile(rf"(?mi)^\s*Credit\s*Available\s+{AMOUNT}\b"),
        re.compile(rf"(?mis)\bCredit\s*Available\b.*?{AMOUNT}"),
        re.compile(rf"(?mi)^\s*Remaining\s*Credit\s+{AMOUNT}\b"),
        re.compile(rf"(?mis)\bRemaining\s*Credit\b.*?{AMOUNT}"),
    ],
    "payment_due_date": [
        re.compile(rf"(?mi)^\s*Payment\s*Due\s*Date\s+{DATE_NUM}\b"),
        re.compile(rf"(?mis)\bPayment\s*Due\s*Date\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
        re.compile(rf"(?mis)\bDue\s*Date\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
        re.compile(rf"(?mis)\bPay\s*By\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
        re.compile(rf"(?mis)\bClosing\s*Date\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
        re.compile(rf"(?mis)\bStatement\s*Closing\s*Date\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
        re.compile(rf"(?mis)\bStatement\s*ends?\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
    ],
    "new_balance": [
        re.compile(rf"(?mi)^\s*New\s*Balance(?:\s*Total)?\s+{AMOUNT}\b"),
        re.compile(rf"(?mis)\bNew\s*Balance(?:\s*Total)?\b.*?{AMOUNT}"),
        re.compile(rf"(?mi)^\s*Statement\s*Balance\s+{AMOUNT}\b"),
        re.compile(rf"(?mis)\bStatement\s*Balance\b.*?{AMOUNT}"),
        re.compile(rf"(?mi)^\s*Closing\s*Balance\s+{AMOUNT}\b"),
        re.compile(rf"(?mis)\bClosing\s*Balance\b.*?{AMOUNT}"),
        re.compile(rf"(?mis)\bClosing\s*balance\b.*?{AMOUNT}"),
    ],
    "credit_limit": [
        re.compile(rf"(?mi)^\s*(?:Total\s*)?Credit\s*(?:Access\s*Line|Limit|Line)\s+{AMOUNT}\b"),
        re.compile(rf"(?mis)\b(?:Total\s*)?Credit\s*(?:Access\s*Line|Limit|Line)\b.*?{AMOUNT}"),
        re.compile(rf"(?mis)\bApproved\s*Limit\b.*?{AMOUNT}"),
        re.compile(rf"(?mis)\bCredit\s*Line\b.*?{AMOUNT}"),
    ],
}

# Issuer-specific reinforcements
ISSUER_SPECIFIC: Dict[str, Dict[str, List[re.Pattern]]] = {
    "Bank of America": {
        "payment_due_date": [
            re.compile(rf"(?mi)^\s*Payment\s*Due\s*Date\s+{DATE_NUM}\b"),
            re.compile(rf"(?mi)^\s*Payment\s*Due\s*Date\s+{DATE_TEXT1}\b"),
        ],
        "new_balance": [
            re.compile(rf"(?mi)^\s*New\s*Balance\s*Total\s+{AMOUNT}\b"),
            re.compile(rf"(?mis)\bNew\s*Balance\s*Total\b.*?{AMOUNT}"),
        ],
        "credit_limit": [
            re.compile(rf"(?mi)^\s*(?:Total\s*)?Credit\s*(?:Limit|Line)\s+{AMOUNT}\b"),
            re.compile(rf"(?mis)\b(?:Total\s*)?Credit\s*(?:Limit|Line)\b.*?{AMOUNT}"),
        ],
        "available_credit": [
            re.compile(rf"(?mi)^\s*Available\s*(?:Credit|to\s*Spend)\s+{AMOUNT}\b"),
            re.compile(rf"(?mis)\bAvailable\s*(?:Credit|to\s*Spend)\b.*?{AMOUNT}"),
        ],
    },
    "Chase": {
        "payment_due_date": [re.compile(rf"(?mi)^\s*Payment\s*Due\s*Date\s+{DATE_NUM}\b")],
        "new_balance": [re.compile(rf"(?mi)^\s*New\s*Balance\s+{AMOUNT}\b")],
        "credit_limit": [re.compile(rf"(?mi)^\s*(?:Total\s*)?Credit\s*(?:Access\s*Line|Limit|Line)\s+{AMOUNT}\b")],
        "available_credit": [
            re.compile(rf"(?mi)^\s*(?:Credit\s*Available|Available\s*Credit)\s+{AMOUNT}\b"),
            re.compile(rf"(?mis)\b(?:Credit\s*Available|Available\s*Credit)\b.*?{AMOUNT}"),
        ],
    },
    "Commonwealth Bank": {
        "new_balance": [
            re.compile(rf"(?mi)^\s*Closing\s*balance\s+{AMOUNT}\b"),
            re.compile(rf"(?mis)\bClosing\s*balance\b.*?{AMOUNT}"),
        ],
        "available_credit": [
            re.compile(rf"(?mi)^\s*Available\s*(?:Funds|Balance)\s+{AMOUNT}\b"),
            re.compile(rf"(?mis)\bAvailable\s*(?:Funds|Balance)\b.*?{AMOUNT}"),
        ],
        "payment_due_date": [
            re.compile(rf"(?mis)\bStatement\s*ends?\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
            re.compile(rf"(?mis)\bClosing\s*Date\b.*?(?:{DATE_NUM}|{DATE_TEXT1}|{DATE_TEXT2})"),
        ],
        "credit_limit": [
            re.compile(rf"(?mis)\bApproved\s*Limit\b.*?{AMOUNT}"),
            re.compile(rf"(?mis)\bCredit\s*Limit\b.*?{AMOUNT}"),
        ],
    },
}

# ---------- Helpers ----------

def detect_provider(text: str) -> Optional[str]:
    for name, pats in PROVIDERS:
        if any(p.search(text) for p in pats):
            return name
    return None

def _normalize_amount(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    s = raw.strip()
    s = re.sub(r"\s*(CR|DR)\b", "", s, flags=re.I).strip()
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("() ").replace(" ", "").lstrip("$")
    s = s.replace("O0.00", "0.00").replace("O", "0")  # OCR quirks
    if re.fullmatch(r"\d{1,3}(?:,\d{3})*", s):
        s = s + ".00"
    out = f"${s}"
    if neg:
        out = "-" + out
    return out

def _money_to_float(v: Optional[str]) -> Optional[float]:
    if not v:
        return None
    try:
        return float(v.replace("$", "").replace(",", ""))
    except Exception:
        return None

def _fmt_money(x: float) -> str:
    return "${:,.2f}".format(x)

CURR_ANY = re.compile(r"\$?\s*-?\(?\d[\d,]*\.?\d{0,2}\)?(?:\s*(?:CR|DR))?")

def _collect_amounts_near(lines: List[str], i: int, start_col: int, lines_ahead: int) -> List[str]:
    cands: List[str] = []
    # same-line after label
    after = lines[i][start_col:]
    cands += [m.group(0).strip() for m in CURR_ANY.finditer(after)]
    # next few lines
    for j in range(1, lines_ahead + 1):
        if i + j < len(lines):
            cands += [m.group(0).strip() for m in CURR_ANY.finditer(lines[i + j])]
    return cands

def _best_amount_for_label(label: str, candidates: List[str], avoid_zero: bool = True, min_value: float = 0.0) -> Optional[str]:
    scored: List[Tuple[float, str]] = []
    for raw in candidates:
        n = _normalize_amount(raw)
        v = _money_to_float(n)
        if v is None:
            continue
        if avoid_zero and v == 0.0:
            continue
        if v < min_value:
            continue
        score = 0.0
        if "$" in raw: score += 0.5
        if "," in raw: score += 1.0
        score += min(v / 10000.0, 5.0)  # favor larger, but cap
        # For limits, prefer >= 1000
        if re.search(r"limit|line", label, flags=re.I) and v < 500:
            score -= 3.0
        scored.append((score, n))
    if not scored:
        return None
    scored.sort(reverse=True)
    return scored[0][1]

def extract_label_amount_lines(text: str, label_regexes: List[re.Pattern], lines_ahead: int = 3,
                               avoid_zero: bool = False, min_value: float = 0.0) -> Optional[str]:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        for lr in label_regexes:
            m = lr.search(line)
            if not m:
                continue
            cands = _collect_amounts_near(lines, i, m.end(), lines_ahead)
            best = _best_amount_for_label(lr.pattern, cands, avoid_zero=avoid_zero, min_value=min_value)
            if best:
                return best
    return None

def _try_parse_date(s: str) -> Optional[datetime]:
    fmts = [
        "%m/%d/%y", "%m/%d/%Y",
        "%b %d, %Y", "%B %d, %Y",
        "%d %b %Y", "%d %B %Y",
        "%b %d, %y", "%B %d, %y",
        "%d %b %y", "%d %B %y",
    ]
    for f in fmts:
        try:
            return datetime.strptime(s, f)
        except Exception:
            continue
    return None

def _normalize_date(text_fragment: str) -> Optional[str]:
    m = DATE_FINDER.search(text_fragment)
    if not m:
        return None
    d = _try_parse_date(m.group(0))
    if not d:
        return None
    return d.strftime("%m/%d/%y")

def extract_label_date_lines(text: str, label_regexes: List[re.Pattern], lines_ahead: int = 2) -> Optional[str]:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        for lr in label_regexes:
            if not lr.search(line):
                continue
            segs = [line]
            for j in range(1, lines_ahead + 1):
                if i + j < len(lines):
                    segs.append(lines[i + j])
            cand = _normalize_date("\n".join(segs))
            if cand:
                return cand
    return None

# Label sets (issuer-aware)
LBL_BOA_LIMIT = [re.compile(r"(?i)\b(?:Total\s*)?Credit\s*(?:Limit|Line)\b")]
LBL_BOA_AVAIL = [re.compile(r"(?i)\bAvailable\s*(?:Credit|to\s*Spend)\b")]
LBL_BOA_NEWBAL = [re.compile(r"(?i)\bNew\s*Balance\s*Total\b")]
LBL_BOA_DUE = [re.compile(r"(?i)\bPayment\s*Due\s*Date\b")]

# Generic labels
LBL_AVAIL = [
    re.compile(r"(?i)\bAvailable\s*(?:Credit|to\s*Spend|Funds|Balance|Credit\s*Line)\b"),
    re.compile(r"(?i)\bCredit\s*Available\b"),
    re.compile(r"(?i)\bRemaining\s*Credit\b"),
]
LBL_NEWBAL = [
    re.compile(r"(?i)\bNew\s*Balance(?:\s*Total)?\b"),
    re.compile(r"(?i)\bStatement\s*Balance\b"),
    re.compile(r"(?i)\bClosing\s*Balance\b"),
    re.compile(r"(?i)\bClosing\s*balance\b"),
]
LBL_LIMIT = [
    re.compile(r"(?i)\b(?:Total\s*)?Credit\s*(?:Access\s*Line|Limit|Line)\b"),
    re.compile(r"(?i)\bApproved\s*Limit\b"),
]
LBL_DUEDATE = [
    re.compile(r"(?i)\bPayment\s*Due\s*Date\b"),
    re.compile(r"(?i)\bDue\s*Date\b"),
    re.compile(r"(?i)\bPay\s*By\b"),
    re.compile(r"(?i)\bClosing\s*Date\b"),
    re.compile(r"(?i)\bStatement\s*Closing\s*Date\b"),
    re.compile(r"(?i)\bStatement\s*ends?\b"),
]

# ---------- Core parse ----------

@dataclass
class ParsedStatement:
    file: str
    card_provider: Optional[str]
    available_credit: Optional[str]
    payment_due_date: Optional[str]
    new_balance: Optional[str]
    credit_limit: Optional[str]

def find_first_amount(text: str, patterns: List[re.Pattern]) -> Optional[str]:
    for p in patterns:
        m = p.search(text)
        if not m:
            continue
        # search all amounts within match; choose largest non-zero
        amounts = [m2.group(0) for m2 in CURR_ANY.finditer(m.group(0))]
        best = _best_amount_for_label(p.pattern, amounts, avoid_zero=True)
        if best:
            return best
    return None

def find_first_date(text: str, patterns: List[re.Pattern]) -> Optional[str]:
    for p in patterns:
        m = p.search(text)
        if not m:
            continue
        out = _normalize_date(m.group(0))
        if out:
            return out
    return None

def parse_statement_text(text: str) -> ParsedStatement:
    issuer = detect_provider(text) or "Unknown"

    # 1) Issuer-specific strong patterns first
    available_credit = find_first_amount(text, ISSUER_SPECIFIC.get(issuer, {}).get("available_credit", []))
    payment_due_date = find_first_date(text, ISSUER_SPECIFIC.get(issuer, {}).get("payment_due_date", []))
    new_balance = find_first_amount(text, ISSUER_SPECIFIC.get(issuer, {}).get("new_balance", []))
    credit_limit = find_first_amount(text, ISSUER_SPECIFIC.get(issuer, {}).get("credit_limit", []))

    # 2) Global patterns if still missing
    if not available_credit:
        available_credit = find_first_amount(text, PATTERNS["available_credit"])
    if not payment_due_date:
        payment_due_date = find_first_date(text, PATTERNS["payment_due_date"])
    if not new_balance:
        new_balance = find_first_amount(text, PATTERNS["new_balance"])
    if not credit_limit:
        credit_limit = find_first_amount(text, PATTERNS["credit_limit"])

    # 3) Line-anchored label extraction (issuer-aware first, then generic)
    if issuer == "Bank of America":
        # Prefer the maximum near the label; exclude zero; enforce sensible mins
        if not new_balance:
            new_balance = extract_label_amount_lines(text, LBL_BOA_NEWBAL, lines_ahead=2, avoid_zero=True, min_value=10.0)
        if not credit_limit:
            credit_limit = extract_label_amount_lines(text, LBL_BOA_LIMIT, lines_ahead=3, avoid_zero=True, min_value=500.0)
        if not available_credit:
            available_credit = extract_label_amount_lines(text, LBL_BOA_AVAIL, lines_ahead=3, avoid_zero=False, min_value=0.0)
        if not payment_due_date:
            payment_due_date = extract_label_date_lines(text, LBL_BOA_DUE, lines_ahead=1)
    else:
        if not new_balance:
            new_balance = extract_label_amount_lines(text, LBL_NEWBAL, lines_ahead=3, avoid_zero=False)
        if not credit_limit:
            credit_limit = extract_label_amount_lines(text, LBL_LIMIT, lines_ahead=3, avoid_zero=True, min_value=500.0)
        if not available_credit:
            available_credit = extract_label_amount_lines(text, LBL_AVAIL, lines_ahead=3, avoid_zero=False)
        if not payment_due_date:
            payment_due_date = extract_label_date_lines(text, LBL_DUEDATE, lines_ahead=2)

    # 4) Compute missing fields where safe
    lim = _money_to_float(credit_limit)
    bal = _money_to_float(new_balance)
    avl = _money_to_float(available_credit)

    # Only compute credit_limit if both avl and bal exist and bal > 0 (avoids wrong BOA sums when NB misread as 0)
    if credit_limit is None and avl is not None and bal is not None and bal > 0:
        credit_limit = _fmt_money(avl + bal)

    # If available_credit missing but limit & balance are good, compute
    if available_credit is None and lim is not None and bal is not None and lim >= bal:
        available_credit = _fmt_money(lim - bal)

    # 5) Guardrails
    def suspicious_limit(v: Optional[str]) -> bool:
        if not v: return False
        x = _money_to_float(v)
        if x is None: return False
        return x < 100.0  # BOA/Chase real limits won't be < $100
    if suspicious_limit(credit_limit):
        credit_limit = None

    return ParsedStatement(
        file="",
        card_provider=issuer,
        available_credit=available_credit,
        payment_due_date=payment_due_date,
        new_balance=new_balance,
        credit_limit=credit_limit,
    )

def parse_pdf(path: str) -> ParsedStatement:
    text = ocr_pdf_to_text(path)
    parsed = parse_statement_text(text)
    parsed.file = path
    return parsed


# ---------- CLI ----------

def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="OCR-based credit card statement parser (BOA/Chase/Commonwealth improved)")
    ap.add_argument("pdfs", nargs="+", help="PDF paths")
    ap.add_argument("--format", choices=["json", "csv"], default="json")
    ap.add_argument("--dpi", type=int, default=340, help="Render DPI for OCR (default 340)")
    args = ap.parse_args(argv)

    results: List[ParsedStatement] = []
    for p in args.pdfs:
        try:
            results.append(parse_pdf(p))
        except Exception:
            results.append(ParsedStatement(
                file=p,
                card_provider=None,
                available_credit=None,
                payment_due_date=None,
                new_balance=None,
                credit_limit=None,
            ))

    if args.format == "json":
        print(json.dumps([asdict(r) for r in results], indent=2))
    else:
        import csv
        w = csv.writer(sys.stdout, lineterminator="\n")
        w.writerow(["file", "card_provider", "available_credit", "payment_due_date", "new_balance", "credit_limit"])
        for r in results:
            w.writerow([
                r.file,
                r.card_provider or "",
                r.available_credit or "",
                r.payment_due_date or "",
                r.new_balance or "",
                r.credit_limit or "",
            ])
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

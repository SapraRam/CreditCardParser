#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple

# ---------------------------
# PDF text extraction helpers
# ---------------------------

def extract_text_from_pdf(path: str) -> str:
    """
    Try extracting text using pdfplumber, then PyPDF2, then pdfminer.six as a fallback.
    """
    text = ""
    # Attempt 1: pdfplumber
    try:
        import pdfplumber  # type: ignore
        with pdfplumber.open(path) as pdf:
            pages_text = []
            for page in pdf.pages:
                pages_text.append(page.extract_text() or "")
            text = "\n".join(pages_text)
    except Exception:
        pass

    # Attempt 2: PyPDF2
    if not text.strip():
        try:
            import PyPDF2  # type: ignore
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                pages_text = []
                for page in reader.pages:
                    pages_text.append(page.extract_text() or "")
                text = "\n".join(pages_text)
        except Exception:
            pass

    # Attempt 3: pdfminer.six
    if not text.strip():
        try:
            from pdfminer.high_level import extract_text as pdfminer_extract_text  # type: ignore
            text = pdfminer_extract_text(path) or ""
        except Exception:
            pass

    # Normalize and clean text
    text = unicodedata.normalize("NFKD", text or "")
    text = text.replace("\xa0", " ")
    # Collapse leaders/dots & extra spaces
    text = re.sub(r"[·•●•]+", " ", text)
    text = re.sub(r"[\.]{2,}", " ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text


# ---------------------------
# Detection & extraction
# ---------------------------

ISSUER_DETECTORS: List[Tuple[str, List[re.Pattern]]] = [
    ("Bank of America", [
        re.compile(r"\bBank\s+of\s+America\b", re.I),
        re.compile(r"\bBANK\s+OF\s+AMERICA\b"),
        re.compile(r"\bbankofamerica\.com\b", re.I),
        re.compile(r"\bBank\s*of\s*America,\s*N\.?A\.?\b", re.I),
        re.compile(r"\bBofA\b", re.I),
        re.compile(r"\bB\s*A\s*N\s*K\s*O\s*F\s*A\s*M\s*E\s*R\s*I\s*C\s*A\b", re.I),  # spaced OCR
    ]),
    ("Chase", [
        re.compile(r"\bChase\s+Card\s+Services\b", re.I),
        re.compile(r"\bchase\.com\b", re.I),
        re.compile(r"\bJPMorgan\s+Chase\b", re.I),
        re.compile(r"\bChase\b(?!\w)", re.I),
    ]),
    ("American Express", [
        re.compile(r"\bAmerican\s+Express\b", re.I),
        re.compile(r"\bAMERICAN\s+EXPRESS\b"),
        re.compile(r"\bAMEX\b", re.I),
    ]),
    ("Citi", [
        re.compile(r"\bCitibank\b", re.I),
        re.compile(r"\bCiti\s*Cards?\b", re.I),
        re.compile(r"\bCiti\b(?!\w)", re.I),
        re.compile(r"\bciticards\b", re.I),
    ]),
    ("Capital One", [
        re.compile(r"\bCapital\s+One\b", re.I),
        re.compile(r"\bcapitalone\.com\b", re.I),
    ]),
]

# Currency and date patterns
AMOUNT_CORE = r"[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?"
AMOUNT = rf"\$?\s*({AMOUNT_CORE})"
CURR_STRICT = re.compile(r"\$?\s*[0-9][0-9,]*\.\d{2}")
CURR_RELAXED = re.compile(r"\$?\s*[0-9][0-9,]*(?:\.\d{2})?")
DATE_NUMERIC = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{2,4})\b")
DATE_MIXED = re.compile(r"\b([A-Za-z]{3,9}\s+\d{1,2},\s*\d{2,4})\b")
SEP = r"[ \t]*[:\-\._]*[ \t]*"

# Multiline anchors help grab values from the same row (common in issuer summary tables)
PATTERNS = {
    "available_credit": [
        re.compile(rf"(?mi)^\s*Available\s*(?:Credit|to\s*Spend|Line|Credit\s*Line)\s+(\$?\s*{AMOUNT_CORE})\b"),
        re.compile(rf"\bAvailable\s*(?:Credit|Credit\s*Limit|Credit\s*Line|to\s*Spend){SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bCredit\s*Available{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bRemaining\s*Credit{SEP}{AMOUNT}\b", re.I),
        # cross-line fallback
        re.compile(rf"\b(?:Available\s*(?:Credit|to\s*Spend)|Credit\s*Available|Remaining\s*Credit)\b.{0,160}?(\$?\s*{AMOUNT_CORE})", re.I | re.S),
    ],
    "payment_due_date": [
        re.compile(rf"(?mi)^\s*Payment\s*Due\s*Date\s+(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\b"),
        re.compile(rf"\bPayment\s*Due\s*Date{SEP}(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\b", re.I),
        re.compile(rf"\bDue\s*Date{SEP}(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\b", re.I),
        re.compile(rf"\bPayment\s*Due\s*Date{SEP}([A-Za-z]{{3,9}}\s+\d{{1,2}},\s*\d{{2,4}})\b", re.I),
        re.compile(rf"\bDue\s*Date{SEP}([A-Za-z]{{3,9}}\s+\d{{1,2}},\s*\d{{2,4}})\b", re.I),
        re.compile(r"\bPayment\s*Due\s*Date\b.{0,60}?(\d{1,2}/\d{1,2}/\d{2,4})", re.I | re.S),
    ],
    "new_balance": [
        re.compile(rf"(?mi)^\s*New\s*Balance(?:\s*Total)?\s+(\$?\s*{AMOUNT_CORE})\b"),
        re.compile(rf"\bNew\s*Balance\s*Total{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bNew\s*Balance{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bBalance\s*New{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bNew\s*Balance\b.{0,120}?(\$?\s*{AMOUNT_CORE})", re.I | re.S),
    ],
    "credit_limit": [
        re.compile(rf"(?mi)^\s*(?:Total\s*)?Credit\s*(?:Access\s*Line|Limit|Line)\s+(\$?\s*{AMOUNT_CORE})\b"),
        re.compile(rf"\bCredit\s*Limit{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bTotal\s*Credit\s*Limit{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bCredit\s*Line{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bCredit\s*Access\s*Line{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bRevolving\s*Credit\s*Line{SEP}{AMOUNT}\b", re.I),
        re.compile(rf"\bCredit\s*Limit\b.{0,160}?(\$?\s*{AMOUNT_CORE})", re.I | re.S),
    ],
}

ISSUER_SPECIFIC: Dict[str, Dict[str, List[re.Pattern]]] = {
    "Bank of America": {
        "available_credit": [
            re.compile(rf"(?mi)^\s*Available\s*(?:Credit|to\s*Spend|Credit\s*Line)\s+(\$?\s*{AMOUNT_CORE})\b"),
            re.compile(rf"\bAvailable\s*(?:Credit|to\s*Spend)\b.{0,160}?(\$?\s*{AMOUNT_CORE})", re.I | re.S),
        ],
        "payment_due_date": [
            re.compile(rf"(?mi)^\s*Payment\s*Due\s*Date\s+(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\b"),
        ],
        "new_balance": [
            re.compile(rf"(?mi)^\s*New\s*Balance\s*Total\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
        "credit_limit": [
            re.compile(rf"(?mi)^\s*(?:Total\s*)?Credit\s*(?:Limit|Line)\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
    },
    "Chase": {
        "available_credit": [
            re.compile(rf"(?mi)^\s*Available\s*(?:Credit|to\s*Spend)\s+(\$?\s*{AMOUNT_CORE})\b"),
            re.compile(rf"\bCredit\s*Available{SEP}{AMOUNT}\b", re.I),
        ],
        "credit_limit": [
            re.compile(rf"(?mi)^\s*(?:Total\s*)?Credit\s*(?:Access\s*Line|Limit|Line)\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
        "new_balance": [
            re.compile(rf"(?mi)^\s*New\s*Balance\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
    },
    "American Express": {
        "available_credit": [
            re.compile(rf"(?mi)^\s*Available\s*(?:Credit|to\s*Spend)\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
        "new_balance": [
            re.compile(rf"(?mi)^\s*New\s*Balance(?:\s*Total)?\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
    },
    "Citi": {
        "available_credit": [
            re.compile(rf"(?mi)^\s*(?:Credit\s*Available|Available\s*Credit|Available\s*Line)\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
        "credit_limit": [
            re.compile(rf"(?mi)^\s*(?:Revolving\s*Credit\s*Line|Total\s*Credit\s*Limit|Credit\s*Limit)\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
    },
    "Capital One": {
        "available_credit": [
            re.compile(rf"(?mi)^\s*(?:Available\s*Credit|Credit\s*Available)\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
        "credit_limit": [
            re.compile(rf"(?mi)^\s*(?:Credit\s*Limit|Total\s*Credit\s*Limit|Credit\s*Line)\s+(\$?\s*{AMOUNT_CORE})\b"),
        ],
    },
}

def detect_issuer(text: str) -> Optional[str]:
    for issuer, patterns in ISSUER_DETECTORS:
        if any(p.search(text) for p in patterns):
            return issuer
    return None

def _first_group(m: re.Match) -> Optional[str]:
    if not m:
        return None
    for g in m.groups():
        if g and isinstance(g, str) and g.strip():
            return g.strip()
    return None

def find_first_match(text: str, patterns: List[re.Pattern]) -> Optional[str]:
    for p in patterns:
        m = p.search(text)
        if m:
            out = _first_group(m)
            if out:
                return out
    return None

def sanitize_amount_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    v = v.replace(" ", "")
    v = v.lstrip("$")
    # ensure two decimals if missing
    if re.fullmatch(r"[0-9]{1,3}(?:,[0-9]{3})*", v):
        v = v + ".00"
    return "$" + v

def parse_money_to_float(v: str) -> Optional[float]:
    try:
        return float(v.replace("$", "").replace(",", ""))
    except Exception:
        return None

def extract_by_label_line(text: str, label_regexes: List[re.Pattern], lines_ahead: int = 2) -> Optional[str]:
    """
    Grab the first currency that appears on the SAME line after the label.
    If none, look ahead up to 'lines_ahead' lines. Prefer the first non-zero amount.
    """
    lines = text.splitlines()
    for i, line in enumerate(lines):
        for lr in label_regexes:
            m = lr.search(line)
            if not m:
                continue
            fragment = line[m.end():]
            # same-line candidates AFTER the label
            same_line = list(CURR_STRICT.finditer(fragment)) or list(CURR_RELAXED.finditer(fragment))
            if same_line:
                vals = [it.group(0).strip() for it in same_line]
                # pick first non-zero if available, else first
                for raw in vals:
                    if parse_money_to_float(raw) not in (0.0, None):
                        return sanitize_amount_str(raw)
                return sanitize_amount_str(vals[0])

            # look into next few lines
            for j in range(1, lines_ahead + 1):
                if i + j >= len(lines):
                    break
                l2 = lines[i + j]
                cands = list(CURR_STRICT.finditer(l2)) or list(CURR_RELAXED.finditer(l2))
                if cands:
                    vals = [it.group(0).strip() for it in cands]
                    for raw in vals:
                        if parse_money_to_float(raw) not in (0.0, None):
                            return sanitize_amount_str(raw)
                    return sanitize_amount_str(vals[0])
    return None

# Label regexes for line-based extraction
LBL_AVAIL_CREDIT = [
    re.compile(r"(?mi)^\s*Available\s*(?:Credit|to\s*Spend|Line|Credit\s*Line)\b"),
    re.compile(r"\bAvailable\s*Credit\b", re.I),
    re.compile(r"\bCredit\s*Available\b", re.I),
    re.compile(r"\bRemaining\s*Credit\b", re.I),
]
LBL_DUE_DATE = [
    re.compile(r"(?mi)^\s*Payment\s*Due\s*Date\b"),
    re.compile(r"\bPayment\s*Due\s*Date\b", re.I),
    re.compile(r"\bDue\s*Date\b", re.I),
]
LBL_NEW_BAL = [
    re.compile(r"(?mi)^\s*New\s*Balance(?:\s*Total)?\b"),
    re.compile(r"\bNew\s*Balance\s*Total\b", re.I),
    re.compile(r"\bNew\s*Balance\b", re.I),
]
LBL_CREDIT_LIMIT = [
    re.compile(r"(?mi)^\s*(?:Total\s*)?Credit\s*(?:Access\s*Line|Limit|Line)\b"),
    re.compile(r"\bCredit\s*Limit\b", re.I),
    re.compile(r"\bTotal\s*Credit\s*Limit\b", re.I),
    re.compile(r"\bCredit\s*Access\s*Line\b", re.I),
    re.compile(r"\bCredit\s*Line\b", re.I),
    re.compile(r"\bRevolving\s*Credit\s*Line\b", re.I),
]

@dataclass
class ParsedStatement:
    file: str
    card_provider: Optional[str]
    available_credit: Optional[str]
    payment_due_date: Optional[str]
    new_balance: Optional[str]
    credit_limit: Optional[str]

def parse_statement_text(text: str) -> ParsedStatement:
    issuer = detect_issuer(text) or "Unknown"

    # Primary regex paths
    available_credit = find_first_match(text, PATTERNS["available_credit"])
    payment_due_date = find_first_match(text, PATTERNS["payment_due_date"])
    new_balance = find_first_match(text, PATTERNS["new_balance"])
    credit_limit = find_first_match(text, PATTERNS["credit_limit"])

    # Issuer-specific fallbacks
    if issuer in ISSUER_SPECIFIC:
        isp = ISSUER_SPECIFIC[issuer]
        if not available_credit and "available_credit" in isp:
            available_credit = find_first_match(text, isp["available_credit"])
        if not payment_due_date and "payment_due_date" in isp:
            payment_due_date = find_first_match(text, isp["payment_due_date"])
        if not new_balance and "new_balance" in isp:
            new_balance = find_first_match(text, isp["new_balance"])
        if not credit_limit and "credit_limit" in isp:
            credit_limit = find_first_match(text, isp["credit_limit"])

    # Line-based fallbacks (robust for column wraps)
    if not available_credit:
        available_credit = extract_by_label_line(text, LBL_AVAIL_CREDIT, lines_ahead=3)
    if not payment_due_date:
        # date from same/next line
        lines = text.splitlines()
        got_date = None
        for i, line in enumerate(lines):
            if any(p.search(line) for p in LBL_DUE_DATE):
                m = DATE_NUMERIC.search(line) or DATE_MIXED.search(line)
                if not m and i + 1 < len(lines):
                    m = DATE_NUMERIC.search(lines[i + 1]) or DATE_MIXED.search(lines[i + 1])
                if m:
                    got_date = m.group(1)
                    break
        payment_due_date = got_date
    if not new_balance:
        new_balance = extract_by_label_line(text, LBL_NEW_BAL, lines_ahead=3)
    if not credit_limit:
        credit_limit = extract_by_label_line(text, LBL_CREDIT_LIMIT, lines_ahead=3)

    # Clean amounts
    available_credit = sanitize_amount_str(available_credit) if available_credit else None
    new_balance = sanitize_amount_str(new_balance) if new_balance else None
    credit_limit = sanitize_amount_str(credit_limit) if credit_limit else None

    # Guardrails: ignore suspicious "credit limit" values that look like page numbers (e.g., '35')
    def _suspicious_amount(val: Optional[str]) -> bool:
        if not val:
            return False
        raw = val.replace("$", "").replace(",", "")
        if raw.isdigit() and len(raw) <= 2:
            return True
        return False
    if _suspicious_amount(credit_limit):
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
    text = extract_text_from_pdf(path)
    parsed = parse_statement_text(text)
    parsed.file = path
    return parsed

# ---------------------------
# CLI
# ---------------------------

def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Parse credit card statements (PDF) and extract key fields.")
    ap.add_argument("pdfs", nargs="+", help="Paths to PDF files.")
    ap.add_argument("--format", choices=["json", "csv"], default="json", help="Output format.")
    args = ap.parse_args(argv)

    results: List[ParsedStatement] = []
    for path in args.pdfs:
        try:
            results.append(parse_pdf(path))
        except Exception:
            results.append(ParsedStatement(
                file=path,
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
        writer = csv.writer(sys.stdout, lineterminator="\n")
        writer.writerow(["file", "card_provider", "available_credit", "payment_due_date", "new_balance", "credit_limit"])
        for r in results:
            writer.writerow([
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

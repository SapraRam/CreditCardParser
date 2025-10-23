# app.py
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import io
import json
import tempfile
import importlib
from dataclasses import asdict, is_dataclass
from typing import Any, Dict, List, Optional, Tuple

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Configure CORS to allow requests from the frontend
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# ---------------------------
# Parser module auto-discovery
# ---------------------------
# Set PARSER_MODULE env var to your logic filename (without .py)
# Defaults to trying common names if not provided.
PARSER_CANDIDATES = [
    os.environ.get("PARSER_MODULE"),
    "ocr_card_parser",
    "statement_parser",
    "parser",
    "new",
]
PARSER_CANDIDATES = [m for m in PARSER_CANDIDATES if m]

def _load_parser():
    last_err = None
    for name in PARSER_CANDIDATES:
        try:
            return importlib.import_module(name)
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"Could not import parser module from {PARSER_CANDIDATES}: {last_err}")

parser_mod = _load_parser()

# Optional functions in your parser module:
# - parse_pdf_bytes(data: bytes) -> Parsed | dict
# - parse_pdf(path: str) -> Parsed | dict
# - ocr_pdf_to_text(path: str | bytes) + parse_statement_text(text: str)
HAS_PARSE_BYTES = hasattr(parser_mod, "parse_pdf_bytes")
HAS_PARSE_PATH  = hasattr(parser_mod, "parse_pdf")
HAS_OCR_TEXT    = hasattr(parser_mod, "ocr_pdf_to_text")
HAS_PARSE_TEXT  = hasattr(parser_mod, "parse_statement_text")

REQUIRED_KEYS = ["file", "card_provider", "available_credit", "payment_due_date", "new_balance", "credit_limit"]

def _normalize_result(obj: Any, filename: Optional[str]) -> Dict[str, Any]:
    if obj is None:
        out = {k: None for k in REQUIRED_KEYS}
    elif is_dataclass(obj):
        out = asdict(obj)
    elif isinstance(obj, dict):
        out = dict(obj)
    else:
        out = {k: getattr(obj, k, None) for k in REQUIRED_KEYS}
    if filename and not out.get("file"):
        out["file"] = filename
    # Ensure all required keys exist
    for k in REQUIRED_KEYS:
        out.setdefault(k, None)
    return out

def _parse_bytes(filename: str, data: bytes) -> Dict[str, Any]:
    # 1) Preferred: parse_pdf_bytes
    if HAS_PARSE_BYTES:
        res = parser_mod.parse_pdf_bytes(data)  # type: ignore[attr-defined]
        return _normalize_result(res, filename)

    # 2) Fallback: parse_pdf(path)
    if HAS_PARSE_PATH:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(data)
            tmp.flush()
            tmp_path = tmp.name
        try:
            res = parser_mod.parse_pdf(tmp_path)  # type: ignore[attr-defined]
            return _normalize_result(res, filename)
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    # 3) Fallback: OCR text + parse_statement_text
    if HAS_OCR_TEXT and HAS_PARSE_TEXT:
        # Try bytes first if your ocr function supports it; else write to temp
        try:
            text = parser_mod.ocr_pdf_to_text(io.BytesIO(data))  # type: ignore[attr-defined]
            if not isinstance(text, str) or not text.strip():
                raise TypeError
        except Exception:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(data)
                tmp.flush()
                tmp_path = tmp.name
            try:
                text = parser_mod.ocr_pdf_to_text(tmp_path)  # type: ignore[attr-defined]
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
        res = parser_mod.parse_statement_text(text)  # type: ignore[attr-defined]
        return _normalize_result(res, filename)

    raise RuntimeError("No compatible parse function found in parser module.")

# ---------------------------
# Routes
# ---------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy ram  ",
        "service": "Credit Card Parser API",
        "version": "1.0.0",
        "parser_module": parser_mod.__name__
    })

@app.route("/banks", methods=["GET"])
def get_banks():
    """Return list of supported card providers/banks"""
    banks = [
        {"id": "boa", "name": "Bank of America", "status": "active"},
        {"id": "chase", "name": "Chase", "status": "active"},
        {"id": "citi", "name": "Citibank", "status": "active"},
        {"id": "amex", "name": "American Express", "status": "active"},
        {"id": "discover", "name": "Discover", "status": "active"},
    ]
    return jsonify({"success": True, "banks": banks})

@app.route("/parse", methods=["POST"])
def parse_single():
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "Missing 'file' in form-data",
            "message": "Please upload a PDF file"
        }), 400

    f = request.files["file"]
    data = f.read()
    if not data:
        return jsonify({
            "success": False,
            "error": "Empty file",
            "message": "The uploaded file is empty"
        }), 400

    try:
        result = _parse_bytes(f.filename or "uploaded.pdf", data)
        
        # Map backend fields to frontend expected format
        response_data = {
            "success": True,
            "bank": result.get("card_provider", "Unknown"),
            "method": "ocr",  # Since we're using OCR-based parsing
            "data": {
                "payment_due_date": result.get("payment_due_date"),
                "minimum_payment_due": None,  # Not extracted yet
                "new_balance": result.get("new_balance"),
                "available_credit": result.get("available_credit"),
                "credit_limit": result.get("credit_limit")
            },
            "warnings": []
        }
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Failed to parse the PDF file"
        }), 500
# ---------------------------
# Entrypoint
# ---------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)

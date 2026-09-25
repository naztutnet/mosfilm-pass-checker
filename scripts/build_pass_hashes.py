#!/usr/bin/env python3
"""Extract employee surnames from a quarterly pass DOCX and publish only hashes."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from docx import Document


NAMESPACE = "mf-q4-2026"
START_MARKER = "следующим сотрудникам"
END_MARKER = "с уважением"


def normalize_surname(value: str) -> str:
    token = value.strip().split(maxsplit=1)[0].lower().replace("ё", "е")
    return re.sub(r"[^а-я-]", "", token)


def extract_surnames(docx_path: Path) -> list[str]:
    document = Document(docx_path)
    collecting = False
    surnames: list[str] = []

    for paragraph in document.paragraphs:
        text = " ".join(paragraph.text.split()).strip()
        lowered = text.lower()

        if START_MARKER in lowered:
            collecting = True
            continue
        if collecting and END_MARKER in lowered:
            break
        if not collecting or not text:
            continue

        surname = normalize_surname(text)
        if surname:
            surnames.append(surname)

    unique_surnames = sorted(set(surnames))
    if not unique_surnames:
        raise RuntimeError("No surnames found between the expected document markers")
    if len(unique_surnames) != len(surnames):
        raise RuntimeError("Duplicate surnames found; the public checker needs a reviewed policy")
    return unique_surnames


def hash_surname(surname: str) -> str:
    payload = f"{NAMESPACE}:{surname}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def write_javascript(output_path: Path, surnames: list[str]) -> None:
    hashes = sorted(hash_surname(surname) for surname in surnames)
    content = (
        "// Generated from the approved DOCX. Contains hashes only, never names.\n"
        f"window.PASS_CHECK_CONFIG = {json.dumps({'namespace': NAMESPACE, 'phoneDisplay': '8 926 587 79 72', 'phoneHref': 'tel:+79265877972'}, ensure_ascii=False, indent=2)};\n"
        f"window.PASS_SURNAME_HASHES = {json.dumps(hashes, ensure_ascii=False, indent=2)};\n"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    surnames = extract_surnames(args.docx)
    write_javascript(args.out, surnames)
    print(f"Generated {len(surnames)} unique surname hashes")


if __name__ == "__main__":
    main()

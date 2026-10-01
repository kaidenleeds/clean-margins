#!/usr/bin/env python3
"""Fetch and normalize public cleaning-contract notices from SAM.gov."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable

API_URL = "https://api.sam.gov/opportunities/v2/search"
NAICS_CODES = ("561720", "561790")
NOTICE_TYPES = ("o", "k", "p")
LOOKBACK_DAYS = 30
PAGE_SIZE = 1000
SCHEMA = (
    "notice_id",
    "title",
    "agency",
    "state",
    "city",
    "naics",
    "type",
    "posted",
    "deadline",
    "set_aside",
    "url",
)
BROAD_NAICS_CLEANING_TERMS = re.compile(
    r"\b(janitorial|custodial|housekeeping|carpet cleaning|floor cleaning|"
    r"window washing|window cleaning|pressure washing|power washing|soft wash|"
    r"exterior cleaning|building washing|facade cleaning|gutter cleaning|"
    r"roof cleaning|exhaust.*clean|clean.*exhaust|duct.*clean|clean.*duct|"
    r"hood.*clean|clean.*hood)\b",
    re.IGNORECASE,
)


def normalize(record: dict[str, Any]) -> dict[str, str]:
    place = record.get("placeOfPerformance") or {}
    state = (place.get("state") or {}).get("code") or ""
    city = (place.get("city") or {}).get("name") or ""
    return {
        "notice_id": str(record.get("noticeId") or "").strip(),
        "title": str(record.get("title") or "").strip(),
        "agency": str(record.get("fullParentPathName") or "").split(".")[0].strip(),
        "state": str(state).strip(),
        "city": str(city).strip(),
        "naics": str(record.get("naicsCode") or "").strip(),
        "type": str(record.get("type") or "").strip(),
        "posted": str(record.get("postedDate") or "").strip(),
        "deadline": str(record.get("responseDeadLine") or "").strip(),
        "set_aside": str(record.get("typeOfSetAsideDescription") or "").strip(),
        "url": str(record.get("uiLink") or "").strip(),
    }


def is_relevant_record(record: dict[str, Any], requested_naics: str) -> bool:
    record_naics = str(record.get("naicsCode") or "").strip()
    if record_naics != requested_naics:
        return False
    if record_naics == "561720":
        return True
    return bool(BROAD_NAICS_CLEANING_TERMS.search(str(record.get("title") or "")))


def _fingerprint(opportunity: dict[str, str]) -> str:
    def clean(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

    return "|".join(
        (
            clean(opportunity["title"]),
            clean(opportunity["agency"]),
            clean(opportunity["city"]),
            clean(opportunity["state"]),
            opportunity["deadline"][:10],
        )
    )


def clean_opportunities(
    items: list[dict[str, str]], today: date
) -> tuple[list[dict[str, str]], int]:
    notice_ids: set[str] = set()
    fingerprints: set[str] = set()
    clean: list[dict[str, str]] = []
    duplicates = 0

    for opportunity in items:
        notice_id = opportunity["notice_id"]
        if not notice_id:
            continue
        if opportunity["deadline"] and opportunity["deadline"][:10] < today.isoformat():
            continue

        fingerprint = _fingerprint(opportunity)
        if notice_id in notice_ids or fingerprint in fingerprints:
            duplicates += 1
            continue

        notice_ids.add(notice_id)
        fingerprints.add(fingerprint)
        clean.append(opportunity)

    clean.sort(key=lambda item: item["deadline"] or "9999")
    return clean, duplicates


def fetch_live(
    api_key: str,
    today: date | None = None,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> list[dict[str, str]]:
    current_date = today or date.today()
    posted_from = (current_date - timedelta(days=LOOKBACK_DAYS)).strftime("%m/%d/%Y")
    posted_to = current_date.strftime("%m/%d/%Y")
    collected: list[dict[str, str]] = []

    for naics in NAICS_CODES:
        offset = 0
        while True:
            query = urllib.parse.urlencode(
                {
                    "api_key": api_key,
                    "ncode": naics,
                    "postedFrom": posted_from,
                    "postedTo": posted_to,
                    "limit": PAGE_SIZE,
                    "offset": offset,
                    "ptype": NOTICE_TYPES,
                },
                doseq=True,
            )
            with opener(f"{API_URL}?{query}", timeout=60) as response:
                payload = json.load(response)

            records = payload.get("opportunitiesData") or []
            collected.extend(
                normalize(record)
                for record in records
                if is_relevant_record(record, naics)
            )
            offset += len(records)
            total = int(payload.get("totalRecords") or 0)
            if not records or len(records) < PAGE_SIZE or offset >= total:
                break

    clean, _duplicates = clean_opportunities(collected, current_date)
    return clean


def fetch_mock(today: date | None = None) -> list[dict[str, str]]:
    current_date = today or date.today()
    examples = [
        {
            "notice_id": "SAMPLE-001",
            "title": "Janitorial services for a federal office",
            "agency": "GENERAL SERVICES ADMINISTRATION",
            "state": "CO",
            "city": "Denver",
            "naics": "561720",
            "type": "Solicitation",
            "posted": current_date.isoformat(),
            "deadline": (current_date + timedelta(days=14)).isoformat(),
            "set_aside": "Total Small Business Set-Aside",
            "url": "https://sam.gov/",
        },
        {
            "notice_id": "SAMPLE-002",
            "title": "Exterior window washing",
            "agency": "DEPARTMENT OF THE INTERIOR",
            "state": "UT",
            "city": "Salt Lake City",
            "naics": "561790",
            "type": "Combined Synopsis/Solicitation",
            "posted": current_date.isoformat(),
            "deadline": (current_date + timedelta(days=21)).isoformat(),
            "set_aside": "",
            "url": "https://sam.gov/",
        },
    ]
    return examples


def write_outputs(
    rows: list[dict[str, str]], output_dir: Path, generated: date | None = None
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_date = generated or date.today()
    payload = {
        "generated": generated_date.isoformat(),
        "count": len(rows),
        "items": rows,
    }
    (output_dir / "opportunities.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
    with (output_dir / "opportunities.csv").open(
        "w", newline="", encoding="utf-8"
    ) as output:
        writer = csv.DictWriter(output, fieldnames=SCHEMA)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mock", action="store_true", help="Use safe sample records")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "generated",
        help="Directory for generated JSON and CSV files",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.mock:
        rows = fetch_mock()
    else:
        api_key = os.environ.get("SAM_API_KEY", "").strip()
        if not api_key:
            raise SystemExit("SAM_API_KEY is required. Use --mock for sample data.")
        rows = fetch_live(api_key)
    write_outputs(rows, args.output_dir)
    print(f"Wrote {len(rows)} opportunities to {args.output_dir}")


if __name__ == "__main__":
    main()


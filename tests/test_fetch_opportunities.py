import io
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PIPELINE_DIR = Path(__file__).resolve().parents[1] / "pipeline"
sys.path.insert(0, str(PIPELINE_DIR))

import fetch_opportunities as pipeline  # noqa: E402


def sam_record(
    notice_id: str,
    naics: str,
    title: str,
    deadline: str = "2099-08-01T17:00:00-05:00",
) -> dict:
    return {
        "noticeId": notice_id,
        "title": title,
        "fullParentPathName": "AGENCY.OFFICE",
        "naicsCode": naics,
        "type": "Solicitation",
        "postedDate": "2026-09-20",
        "responseDeadLine": deadline,
        "uiLink": f"https://sam.gov/opp/{notice_id}",
        "placeOfPerformance": {
            "state": {"code": "CO"},
            "city": {"name": "Denver"},
        },
    }


class FakeResponse(io.StringIO):
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


class FetchLiveTests(unittest.TestCase):
    def test_filters_wrong_naics_and_unrelated_broad_naics(self):
        calls = []

        def fake_urlopen(url, timeout):
            self.assertEqual(timeout, 60)
            calls.append(url)
            query = parse_qs(urlparse(url).query)
            requested = query["ncode"][0]
            if requested == "561720":
                records = [
                    sam_record("janitorial", "561720", "Office janitorial services"),
                    sam_record("wrong", "999999", "Unrelated record"),
                ]
            else:
                records = [
                    sam_record("windows", "561790", "Exterior window washing"),
                    sam_record("snow", "561790", "Snow and ice removal"),
                ]
            return FakeResponse(
                json.dumps(
                    {"totalRecords": len(records), "opportunitiesData": records}
                )
            )

        rows = pipeline.fetch_live(
            "test-key", today=date(2026, 10, 1), opener=fake_urlopen
        )

        self.assertEqual(
            {row["notice_id"] for row in rows}, {"janitorial", "windows"}
        )
        self.assertEqual(len(calls), 2)
        for url in calls:
            query = parse_qs(urlparse(url).query)
            self.assertIn(query["ncode"][0], pipeline.NAICS_CODES)
            self.assertNotIn("naicsCode", query)
            self.assertEqual(query["ptype"], list(pipeline.NOTICE_TYPES))

    def test_removes_duplicate_titles_with_the_same_context(self):
        first = pipeline.normalize(
            sam_record("one", "561720", "Building janitorial services")
        )
        second = pipeline.normalize(
            sam_record("two", "561720", "Building janitorial services")
        )

        rows, duplicates = pipeline.clean_opportunities(
            [first, second], date(2026, 10, 1)
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(duplicates, 1)

    def test_mock_output_contains_only_sample_records(self):
        rows = pipeline.fetch_mock(today=date(2026, 10, 1))
        with tempfile.TemporaryDirectory() as temp_dir:
            destination = Path(temp_dir)
            pipeline.write_outputs(rows, destination, generated=date(2026, 10, 1))
            payload = json.loads(
                (destination / "opportunities.json").read_text(encoding="utf-8")
            )
            csv_text = (destination / "opportunities.csv").read_text(
                encoding="utf-8"
            )

        self.assertEqual(payload["count"], 2)
        self.assertTrue(all(item["notice_id"].startswith("SAMPLE-") for item in rows))
        self.assertIn("notice_id,title,agency", csv_text)


if __name__ == "__main__":
    unittest.main()

import json
import os
import unittest
from unittest.mock import MagicMock, patch
from app import app, fetch_page, normalize, parse_page


class SearchTests(unittest.TestCase):
    def test_normalization_preserves_unknown_and_rejects_bad_urls(self):
        row = {"title": "Engineer", "company": "Example", "job_url": "https://example.com/job", "job_type": "fulltime", "date_posted": "2026-09-10"}
        self.assertEqual(normalize(row, "linkedin")["type"], "full-time")
        self.assertEqual(normalize({**row, "job_type": None}, "linkedin")["type"], "unknown")
        self.assertIsNone(normalize({**row, "job_url": "javascript:bad"}, "linkedin"))

    def test_structured_posting_keeps_description_and_employment(self):
        item = {"@type": "JobPosting", "title": "ROS2 Engineer", "hiringOrganization": {"name": "Example"}, "employmentType": "FULL_TIME", "jobLocation": {"address": {"addressLocality": "Berlin", "addressCountry": "Germany"}}, "description": "<p>Build robots</p>", "datePosted": "2026-09-10", "url": "/job/1"}
        rows = parse_page('<script type="application/ld+json">' + json.dumps(item) + '</script>', "stepstone", "https://www.stepstone.de")
        self.assertEqual(normalize(rows[0], "stepstone")["description"], "Build robots")
        self.assertEqual(rows[0]["location"], "Berlin, Germany")

    def test_worker_auth_limits_and_all_worker_sources(self):
        with patch.dict(os.environ, {"SEARCH_WORKER_SECRET": "synthetic-secret"}):
            client = app.test_client()
            self.assertEqual(client.post("/search", json={}).status_code, 401)
            headers = {"Authorization": "Bearer synthetic-secret"}
            self.assertEqual(client.post("/search", json={}, headers=headers).status_code, 400)
            with patch("app.isolated_search", side_effect=lambda site, payload: {"source": site, "status": "ok", "jobs": []}):
                response = client.post("/search", headers=headers, json={"term": "Robotics", "location": "Germany", "country": "germany", "limit": 10})
            self.assertEqual({entry["source"] for entry in response.json["sources"]}, {"linkedin", "indeed", "google", "xing"})

    def test_redirects_cannot_leave_trusted_https_host(self):
        response = MagicMock(status_code=302, headers={"Location": "http://127.0.0.1/private"})
        response.__enter__.return_value = response
        with patch("app.requests.get", return_value=response) as get:
            with self.assertRaises(ValueError):
                fetch_page("https://www.xing.com/jobs", "www.xing.com")
            self.assertEqual(get.call_count, 1)

    def test_search_page_is_not_used_as_a_job_url(self):
        items = [{"@type": None}, {"@type": "JobPosting", "title": "Engineer", "hiringOrganization": {"name": "Example"}}]
        rows = parse_page('<script type="application/ld+json">' + json.dumps(items) + '</script>', "xing", "https://www.xing.com/jobs/search")
        self.assertEqual(len(rows), 1)
        self.assertIsNone(normalize(rows[0], "xing"))


if __name__ == "__main__":
    unittest.main()
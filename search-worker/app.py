import hashlib
import hmac
import json
import math
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin, urlparse

from bs4 import BeautifulSoup
from flask import Flask, jsonify, request
import requests

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4096
SITES = ("linkedin", "indeed", "google", "xing")
COUNTRIES = ("germany", "switzerland", "netherlands", "india", "usa", "uk", "canada")


def text(value):
    if value is None or isinstance(value, float) and math.isnan(value):
        return ""
    return str(value)


def normalize(row, site):
    title, company, url = (text(row.get(key)).strip() for key in ("title", "company", "job_url"))
    parsed = urlparse(url)
    if not title or not company or parsed.scheme != "https" or not parsed.hostname or parsed.username:
        return None
    kind = text(row.get("job_type")).lower()
    kind = re.sub(r"[\s_-]", "", kind)
    combined = f"{title} {kind}".lower()
    employment = "unknown"
    for pattern, label in ((r"werkstudent|workingstudent", "working-student"), (r"\bintern\b|internship|praktik", "internship"), (r"parttime|teilzeit", "part-time"), (r"fulltime|vollzeit", "full-time"), (r"contract|freelance", "contract")):
        if re.search(pattern, combined):
            employment = label
            break
    published = None
    try:
        date = datetime.fromisoformat(text(row.get("date_posted")).replace("Z", "+00:00"))
        published = date.replace(tzinfo=date.tzinfo or timezone.utc).isoformat()
    except ValueError:
        pass
    return {"sourceId": f"{site}:{hashlib.sha256(url.encode()).hexdigest()[:24]}", "source": site,
            "title": title[:300], "company": company[:300], "url": url[:2000],
            "location": text(row.get("location"))[:500], "type": employment,
            "remote": text(row.get("is_remote")).lower() == "true",
            "description": BeautifulSoup(text(row.get("description")), "html.parser").get_text(" ", strip=True)[:20000],
            "publishedAt": published}


def json_jobs(value):
    if isinstance(value, list):
        for item in value:
            yield from json_jobs(item)
    elif isinstance(value, dict):
        kind = value.get("@type")
        if kind == "JobPosting" or isinstance(kind, list) and "JobPosting" in kind:
            yield value
        for key in ("@graph", "itemListElement", "item"):
            if key in value:
                yield from json_jobs(value[key])


def parse_page(html, site, base, detail=False):
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            for item in json_jobs(json.loads(script.string or script.get_text())):
                locations = item.get("jobLocation", [])
                if isinstance(locations, dict):
                    locations = [locations]
                places = []
                for location in locations:
                    address = location.get("address", {})
                    if isinstance(address, dict):
                        country = address.get("addressCountry", "")
                        if isinstance(country, dict):
                            country = country.get("name", "")
                        places.append(", ".join(str(part) for part in (address.get("addressLocality"), country) if part))
                organization = item.get("hiringOrganization", {})
                rows.append({"title": item.get("title"), "company": organization.get("name") if isinstance(organization, dict) else organization,
                             "location": "; ".join(places), "job_url": urljoin(base, item["url"]) if item.get("url") else base if detail else "",
                             "description": item.get("description"), "job_type": item.get("employmentType"),
                             "date_posted": item.get("datePosted"), "is_remote": item.get("jobLocationType") == "TELECOMMUTE"})
        except (ValueError, TypeError, AttributeError):
            continue
    if site == "stepstone":
        for card in soup.select("article[data-at='job-item']"):
            def content(selector):
                element = card.select_one(selector)
                return element.get_text(" ", strip=True) if element else ""
            anchor = card.select_one("a[data-at='job-item-title']")
            if anchor:
                rows.append({"title": content("[data-at='job-item-title']"), "company": content("[data-at='job-item-company-name']"),
                             "location": content("[data-at='job-item-location']"), "job_url": urljoin(base, anchor.get("href", "")),
                             "description": content("[data-at='jobcard-content']"), "job_type": card.get_text(" ", strip=True)})
    else:
        for card in soup.select("article"):
            title = card.select_one("h2, h3")
            anchor = card.select_one("a[href*='/jobs/']")
            company = card.select_one("img[aria-label]")
            if title and anchor and company:
                rows.append({"title": title.get_text(" ", strip=True), "company": company.get("aria-label"),
                             "job_url": urljoin(base, anchor.get("href", "")), "description": card.get_text(" ", strip=True),
                             "job_type": card.get_text(" ", strip=True)})
    return rows


def fetch_page(url, host):
    for attempt in range(4):
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != host or parsed.username or parsed.port not in (None, 443):
            raise ValueError("Unsupported listing host")
        with requests.get(url, timeout=12, allow_redirects=False, stream=True, headers={"User-Agent": "RoleviaJobSearch/1.0", "Accept": "text/html"}) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                url = urljoin(url, response.headers.get("Location", ""))
                continue
            if response.status_code in (403, 429):
                raise RuntimeError("blocked")
            if response.status_code != 200:
                raise RuntimeError("unavailable")
            content = bytearray()
            for chunk in response.iter_content(65536):
                content.extend(chunk)
                if len(content) > 5_000_000:
                    raise RuntimeError("unavailable")
            return content.decode(response.encoding or "utf-8", errors="replace")
    raise RuntimeError("unavailable")


def scrape(site, payload):
    term, location, limit = payload["term"], payload["location"], payload["limit"]
    if site in ("linkedin", "indeed", "google"):
        from jobspy import scrape_jobs
        frame = scrape_jobs(site_name=[site], search_term=term, google_search_term=f"{term} jobs in {location}",
                            location=location, country_indeed=payload["country"], results_wanted=limit,
                            hours_old=45 * 24, linkedin_fetch_description=True, description_format="html", verbose=0)
        rows = frame.to_dict("records") if frame is not None else []
    else:
        base = "https://www.stepstone.de" if site == "stepstone" else "https://www.xing.com"
        search_url = f"{base}/jobs/{quote(term.lower().replace(' ', '-'), safe='')}/in-{quote(location.lower().replace(' ', '-'), safe='')}" if site == "stepstone" else base + "/jobs/search?" + urlencode({"keywords": term, "location": location})
        rows = parse_page(fetch_page(search_url, urlparse(base).hostname), site, base)
        def enrich(row):
            if not row.get("date_posted") and row.get("job_url"):
                try:
                    details = parse_page(fetch_page(row["job_url"], urlparse(base).hostname), site, row["job_url"], detail=True)
                    if details:
                        row.update(details[0])
                except (requests.RequestException, RuntimeError, ValueError):
                    pass
            return row
        with ThreadPoolExecutor(max_workers=5) as pool:
            enriched = list(pool.map(enrich, rows[:min(limit, 10)]))
        rows = enriched + rows[min(limit, 10):]
    jobs = [job for row in rows[:limit] if (job := normalize(row, site))]
    return {"source": site, "status": "ok" if jobs else "empty_or_blocked", "jobs": jobs}


def isolated_search(site, payload):
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--provider", site], input=json.dumps(payload),
                                text=True, capture_output=True, timeout=65, check=True)
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        return {"source": site, "status": "timeout", "jobs": []}
    except (subprocess.CalledProcessError, ValueError):
        return {"source": site, "status": "unavailable", "jobs": []}


@app.get("/health")
def health():
    return jsonify({"service": "rolevia-search", "sources": SITES})


@app.post("/search")
def search():
    secret = os.environ.get("SEARCH_WORKER_SECRET", "")
    if not secret or not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + secret):
        return jsonify({"error": "Unauthorized"}), 401
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or any(not isinstance(payload.get(key), str) or not 1 <= len(payload[key]) <= 100 for key in ("term", "location")):
        return jsonify({"error": "Invalid query"}), 400
    if payload.get("country") not in COUNTRIES or type(payload.get("limit")) is not int or not 1 <= payload["limit"] <= 100:
        return jsonify({"error": "Invalid query"}), 400
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(isolated_search, site, payload) for site in SITES]
        results = [future.result() for future in as_completed(futures)]
    return jsonify({"sources": results})


if __name__ == "__main__":
    if sys.argv[1:] == ["--probe"]:
        payload = {"term": "Robotics engineer", "location": "Germany", "country": "germany", "limit": 3}
        with ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(lambda site: isolated_search(site, payload), SITES))
        print(json.dumps([{"source": entry["source"], "status": entry["status"], "count": len(entry["jobs"])} for entry in results]))
    elif len(sys.argv) == 3 and sys.argv[1] == "--provider" and sys.argv[2] in SITES:
        try:
            print(json.dumps(scrape(sys.argv[2], json.load(sys.stdin))))
        except Exception as error:
            status = "timeout" if isinstance(error, requests.Timeout) else "blocked" if str(error) == "blocked" else "unavailable"
            print(json.dumps({"source": sys.argv[2], "status": status, "jobs": []}))
    else:
        app.run(host="127.0.0.1", port=5321)
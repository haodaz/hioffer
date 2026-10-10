"""Places: where each program is, what the climate is like, and labelled notes on living there.

- Coordinates and city: OpenAlex institution record (free, sourced).
- Climate: Open-Meteo archive for the last full year (free, sourced): January lows, July highs, rain days.
- Living notes: one model call, explicitly labelled "general knowledge, verify" with a link to check,
  because there is no free, citable cost-of-living source.
"""
import hashlib
import json
import os
import statistics
from datetime import date
from pathlib import Path

import httpx
import neatlogs

from ..llm import complete_json
from ..tools.scholar import _get as openalex_get

CACHE = Path(os.environ.get("HIOFFER_CACHE_DIR", ".cache/openalex")).parent / "places"

NOTES = """You write short, practical notes for an international PhD applicant about living in a city for
4-6 years. Use general knowledge only and keep to things that are stable and widely known. Never give exact
prices; use bands (low / moderate / high / very high) relative to US university towns. Return JSON:
{"cost_of_living": "low|moderate|high|very high", "rent_note": one sentence,
 "city_feel": one sentence (size, pace, transit, nature),
 "international_note": one sentence (community, food, airports),
 "caveat": "General knowledge as of the model's training; verify before deciding."}"""


def _cached_get(url: str, params: dict) -> dict:
    key = hashlib.sha1(f"{url}?{json.dumps(params, sort_keys=True)}".encode()).hexdigest()
    f = CACHE / f"{key}.json"
    if f.exists():
        return json.loads(f.read_text())
    r = httpx.get(url, params=params, timeout=40)
    r.raise_for_status()
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_text(r.text)
    return r.json()


def institution_geo(name: str) -> dict | None:
    data = openalex_get("/institutions", search=name, per_page=1, select="id,display_name,geo,homepage_url,image_thumbnail_url,image_url")
    res = data.get("results") or []
    if not res or not res[0].get("geo"):
        return None
    g = res[0]["geo"]
    return {"institution": res[0]["display_name"], "openalex_id": res[0]["id"], "homepage": res[0].get("homepage_url"),
            "logo": res[0].get("image_thumbnail_url") or res[0].get("image_url"),
            "city": g.get("city"), "region": g.get("region"), "country": g.get("country"), "lat": g.get("latitude"), "lng": g.get("longitude")}


def climate(lat: float, lng: float) -> dict:
    year = date.today().year - 1
    d = _cached_get("https://archive-api.open-meteo.com/v1/archive",
                    {"latitude": lat, "longitude": lng, "start_date": f"{year}-01-01", "end_date": f"{year}-12-31",
                     "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum", "timezone": "auto"})["daily"]
    def month(vals, m):
        xs = [v for v, t in zip(vals, d["time"]) if t[5:7] == m and v is not None]
        return round(statistics.mean(xs), 1) if xs else None
    rain_days = sum(1 for p in d["precipitation_sum"] if p and p > 1)
    return {"year": year, "jan_low_c": month(d["temperature_2m_min"], "01"), "jul_high_c": month(d["temperature_2m_max"], "07"),
            "rain_days": rain_days, "precip_mm": round(sum(p for p in d["precipitation_sum"] if p)),
            "source": "Open-Meteo archive (ERA5), daily values aggregated"}


@neatlogs.span(kind="AGENT", name="places")
def build_places(programs: list[dict], existing: dict | None = None, log=print) -> dict:
    out = dict(existing or {})
    for p in programs:
        if p["name"] in out:
            continue
        geo = institution_geo(p["institution"])
        if not geo:
            log(f"  [places] no geo for {p['institution']}")
            continue
        cl = climate(geo["lat"], geo["lng"])
        notes = complete_json(NOTES, f"City: {geo['city']}, {geo['region']}, {geo['country']}. University: {geo['institution']}.", max_tokens=400)
        out[p["name"]] = {**geo, "climate": cl, "living": notes,
                          "verify_url": f"https://www.numbeo.com/cost-of-living/in/{(geo['city'] or '').replace(' ', '-')}"}
        log(f"  [places] {p['short']}: {geo['city']} · Jan {cl['jan_low_c']}°C / Jul {cl['jul_high_c']}°C · {cl['rain_days']} rain days")
    return out


RANKINGS = """For each university, give its most recent position in these rankings as you know them:
QS World University Rankings (overall), Times Higher Education World University Rankings (overall),
U.S. News Best Graduate Schools in Computer Science, and CSRankings.org (overall, US). Give integers or null,
plus the ranking year you are using. These are approximate values from your training data, so set
"approx": true. Return JSON: {"year": int, "approx": true,
 "items": [{"institution": exact name as given, "qs_world": int|null, "the_world": int|null, "usnews_cs": int|null, "csrankings_us": int|null}]}"""

RANKING_LINKS = {
    "qs_world": "https://www.topuniversities.com/university-rankings/world-university-rankings",
    "the_world": "https://www.timeshighereducation.com/world-university-rankings",
    "usnews_cs": "https://www.usnews.com/best-graduate-schools/top-science-schools/computer-science-rankings",
    "csrankings_us": "https://csrankings.org/",
}


@neatlogs.span(kind="AGENT", name="rankings")
def build_rankings(institutions: list[str], existing: dict | None = None) -> dict:
    """One model call for all missing institutions; results are labelled approximate and cached."""
    out = dict(existing or {})
    missing = [i for i in institutions if i and i not in out]
    if not missing:
        return out
    res = complete_json(RANKINGS, "\n".join(missing), max_tokens=1200)
    for it in res.get("items", []):
        out[it["institution"]] = {k: it.get(k) for k in ("qs_world", "the_world", "usnews_cs", "csrankings_us")}
        out[it["institution"]].update({"year": res.get("year"), "approx": True,
                                       "caveat": "Approximate, from the model's training data; verify on the official sites.",
                                       "links": RANKING_LINKS})
    return out

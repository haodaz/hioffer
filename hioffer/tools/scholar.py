"""OpenAlex lookups: find an author and list their recent works. No API key needed."""
import hashlib
import json
import os
import time
from pathlib import Path

import httpx

from ..llm import Tool

BASE = "https://api.openalex.org"
HEADERS = {"User-Agent": "hioffer (mailto:hioffer@example.com)"}


CACHE_DIR = Path(os.environ.get("HIOFFER_CACHE_DIR", ".cache/openalex"))


def _get(path: str, **params) -> dict:
    """GET with a disk cache and backoff.

    OpenAlex charges every call against a small free daily budget (shared per IP without a key),
    so identical requests are served from `.cache/openalex/` and a personal key is sent when set.
    """
    if os.environ.get("OPENALEX_MAILTO"):
        params["mailto"] = os.environ["OPENALEX_MAILTO"]
    key = hashlib.sha1(f"{path}?{json.dumps(params, sort_keys=True)}".encode()).hexdigest()
    cached = CACHE_DIR / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text())
    headers = dict(HEADERS)
    if os.environ.get("OPENALEX_API_KEY"):
        headers["Authorization"] = f"Bearer {os.environ['OPENALEX_API_KEY']}"
    for attempt in range(4):
        r = httpx.get(f"{BASE}{path}", params=params, headers=headers, timeout=30)
        if r.status_code == 429:
            retry_after = int(r.headers.get("retry-after", "0") or 0)
            if retry_after > 120:  # daily budget exhausted: waiting will not help
                raise RuntimeError(
                    "OpenAlex daily budget exhausted; set OPENALEX_API_KEY in .env (free key) or retry after reset"
                )
            time.sleep(1.5 * 2**attempt)
            continue
        if r.status_code >= 500:
            time.sleep(1.5 * 2**attempt)
            continue
        r.raise_for_status()
        data = r.json()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cached.write_text(json.dumps(data))
        return data
    r.raise_for_status()
    return r.json()


def find_author(name: str, institution: str = "") -> dict:
    data = _get("/authors", search=name, per_page=5)
    out = []
    for a in data.get("results", []):
        insts = [i.get("display_name", "") for i in (a.get("last_known_institutions") or [])]
        affs = [(x.get("institution") or {}).get("display_name", "") for x in (a.get("affiliations") or [])]
        # Soft match only: faculty often have a lab or industry affiliation as "last known"
        # institution (e.g. a UW professor listed under an AI institute), so never drop candidates.
        hit = bool(institution) and any(institution.lower() in i.lower() for i in insts + affs)
        out.append(
            {
                "id": a["id"].rsplit("/", 1)[-1],
                "name": a.get("display_name"),
                "institutions": insts,
                "past_affiliations": [x for x in affs if x][:6],
                "institution_match": hit,
                "works_count": a.get("works_count"),
                "cited_by_count": a.get("cited_by_count"),
                "topics": [t.get("display_name") for t in (a.get("topics") or [])[:5]],
            }
        )
    out.sort(key=lambda c: (not c["institution_match"], -(c["works_count"] or 0)))
    return {"candidates": out, "hint": "Pick the candidate whose topics/affiliations fit; institution_match is a hint, not a rule."}


def recent_works(author_id: str, since_year: int = 2024, limit: int = 6) -> dict:
    data = _get(
        "/works",
        filter=f"authorships.author.id:{author_id},from_publication_date:{since_year}-01-01",
        sort="cited_by_count:desc",
        per_page=limit,
    )
    works = []
    for w in data.get("results", []):
        loc = w.get("primary_location") or {}
        src = loc.get("source") or {}
        works.append(
            {
                "id": w["id"].rsplit("/", 1)[-1],
                "title": w.get("title"),
                "year": w.get("publication_year"),
                "venue": src.get("display_name"),
                "cited_by": w.get("cited_by_count"),
                "url": loc.get("landing_page_url") or w.get("doi") or w["id"],
                "authors": [a["author"]["display_name"] for a in w.get("authorships", [])[:8]],
                "author_count": len(w.get("authorships", [])),
            }
        )
    return {"author_id": author_id, "works": works,
            "note": "author lists show the first 8 names; every work here lists the queried author among its authorships"}


FIND_AUTHOR = Tool(
    name="find_author",
    description="Look up a researcher on OpenAlex by name (optionally filtered by institution). Returns candidate "
    "author ids with institutions and topics.",
    parameters={
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "institution": {"type": "string", "description": "Substring of the institution name, e.g. 'Washington'"},
        },
        "required": ["name"],
    },
    fn=find_author,
)

RECENT_WORKS = Tool(
    name="recent_works",
    description="List an OpenAlex author's most-cited works since a given year, with titles, venues and URLs.",
    parameters={
        "type": "object",
        "properties": {
            "author_id": {"type": "string", "description": "OpenAlex author id like A5067919401"},
            "since_year": {"type": "integer", "default": 2024},
        },
        "required": ["author_id"],
    },
    fn=recent_works,
)


def author_profile(author_id: str) -> dict:
    """Affiliation history with years: used for alumni overlap."""
    a = _get(f"/authors/{author_id}")
    return {
        "id": author_id,
        "name": a.get("display_name"),
        "affiliations": [
            {"institution": (x.get("institution") or {}).get("display_name"), "years": x.get("years") or []}
            for x in (a.get("affiliations") or [])
        ],
        "url": a["id"],
    }


def coauthors(author_id: str, since_year: int = 2021, limit: int = 100) -> dict:
    """Co-author set from recent works: name, id, shared paper count and one example paper."""
    data = _get(
        "/works",
        filter=f"authorships.author.id:{author_id},from_publication_date:{since_year}-01-01",
        per_page=limit,
        select="id,title,publication_year,authorships",
    )
    people: dict[str, dict] = {}
    for w in data.get("results", []):
        for au in w.get("authorships", []):
            aid = au["author"]["id"].rsplit("/", 1)[-1]
            if aid == author_id:
                continue
            p = people.setdefault(aid, {"id": aid, "name": au["author"]["display_name"], "papers": 0, "example": None})
            p["papers"] += 1
            if not p["example"]:
                p["example"] = {"id": w["id"].rsplit("/", 1)[-1], "title": w.get("title"), "year": w.get("publication_year")}
    return {"author_id": author_id, "works_scanned": len(data.get("results", [])), "coauthors": list(people.values())}

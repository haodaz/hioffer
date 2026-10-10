"""OpenAlex lookups: find an author and list their recent works. No API key needed."""
import httpx

from ..llm import Tool

BASE = "https://api.openalex.org"
HEADERS = {"User-Agent": "hioffer (mailto:hioffer@example.com)"}


def _get(path: str, **params) -> dict:
    r = httpx.get(f"{BASE}{path}", params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def find_author(name: str, institution: str = "") -> dict:
    data = _get("/authors", search=name, per_page=5)
    out = []
    for a in data.get("results", []):
        insts = [i.get("display_name", "") for i in a.get("last_known_institutions", [])]
        if institution and not any(institution.lower() in i.lower() for i in insts):
            continue
        out.append(
            {
                "id": a["id"].rsplit("/", 1)[-1],
                "name": a.get("display_name"),
                "institutions": insts,
                "works_count": a.get("works_count"),
                "cited_by_count": a.get("cited_by_count"),
                "topics": [t.get("display_name") for t in a.get("topics", [])[:5]],
            }
        )
    return {"candidates": out}


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
                "authors": [a["author"]["display_name"] for a in w.get("authorships", [])[:6]],
            }
        )
    return {"author_id": author_id, "works": works}


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

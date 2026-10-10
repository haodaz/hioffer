"""Recommender: which programs should the applicant even consider?

Evidence first: OpenAlex counts of recent papers per institution on the applicant's topics (universities
only). Then one model call positions the applicant and tiers the candidates as reach / match / safety with
reasons that cite those counts. It must not invent admit rates, deadlines or requirements; those come later
from the program_researcher with sources.
"""
import json
from urllib.parse import quote

import neatlogs

from ..config import CHEAP_MODEL
from ..llm import complete_json
from ..tools.scholar import _get

QUERIES = """From a PhD applicant's research interests, write 5 OpenAlex title/abstract search phrases.
Each phrase is 2-3 words of standard terminology that appears verbatim in paper titles (e.g. "low-resource
languages", "code-switching", "multilingual language models", "tokenizer adaptation"). Every word must match,
so never combine two topics in one phrase and avoid rare wording.
Return JSON: {"queries": ["...", "...", "...", "...", "..."]}"""

TIER = """You position a PhD applicant and tier candidate institutions for CS PhD applications.
You get: the applicant's profile facts, and for each institution the number of recent (2024+) papers on the
applicant's topics from OpenAlex (hard evidence of research activity, not of admission odds).
Rules: tier by research-activity fit AND selectivity as generally known for the institution's CS department;
say explicitly that selectivity is general knowledge, not data. Never state admit rates, deadlines, fees or
requirements. Reasons must cite the paper counts. Pick 8-10 institutions across the three tiers.
Return JSON: {"positioning": 2-3 sentences on where this profile sits and what would strengthen it,
 "tiers": {"reach": [...], "match": [...], "safety": [...]} where each item is
 {"institution": exact name from the list, "department_guess": e.g. "Computer Science" or "Language Technologies Institute",
  "papers": int, "reason": one sentence citing the count}}"""


@neatlogs.span(kind="AGENT", name="recommender")
def recommend_programs(library: dict, country: str = "US", log=print) -> dict:
    interests = next((i["text"] for i in library["items"] if i["type"] == "interests"), "")
    facts = [f for i in library["items"] for f in i["key_facts"]]
    q = complete_json(QUERIES, interests or "\n".join(facts), model=CHEAP_MODEL, max_tokens=200)
    counts: dict[str, dict] = {}
    for phrase in q.get("queries", [])[:5]:
        flt = (f"title_and_abstract.search:{phrase},from_publication_date:2024-01-01,"
               f"authorships.countries:{country},authorships.institutions.type:education")
        data = _get("/works", filter=flt, group_by="authorships.institutions.lineage", per_page=25)
        log(f"  [recommender] openalex '{phrase}': {len(data.get('group_by', []))} institutions")
        for g in data.get("group_by", []):
            name = g["key_display_name"]
            c = counts.setdefault(name, {"institution": name, "openalex_id": g["key"].rsplit("/", 1)[-1], "papers": 0, "queries": {}})
            c["papers"] += g["count"]
            c["queries"][phrase] = g["count"]
    ranked = sorted(counts.values(), key=lambda c: -c["papers"])[:20]
    for c in ranked:
        c["evidence_url"] = ("https://api.openalex.org/works?filter=" + quote(
            f"authorships.institutions.lineage:{c['openalex_id']},from_publication_date:2024-01-01,"
            f"title_and_abstract.search:{list(c['queries'])[0]}"))
    tiers = complete_json(
        TIER,
        "PROFILE FACTS:\n" + "\n".join(facts) + "\n\nINTERESTS:\n" + interests
        + "\n\nCANDIDATES (recent papers on the applicant's topics):\n"
        + json.dumps([{k: c[k] for k in ("institution", "papers", "queries")} for c in ranked], ensure_ascii=False),
        max_tokens=2500,
    )
    by_name = {c["institution"]: c for c in ranked}
    for tier, items in tiers.get("tiers", {}).items():
        for it in items:
            src = by_name.get(it.get("institution"), {})
            it["papers"] = src.get("papers", it.get("papers"))
            it["evidence_url"] = src.get("evidence_url")
            it["tier"] = tier
    return {"queries": q.get("queries", []), "country": country, "candidates": ranked, **tiers,
            "caveat": "Paper counts are OpenAlex evidence of research activity; tiers add general knowledge of selectivity, not admissions data."}

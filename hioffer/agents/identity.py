"""Identity anchoring for advisors: is the OpenAlex record the same person as the faculty-page entry?

Deliberately small. Two sources, no LLM:
  1. the department's faculty directory / profile page, where the name came from;
  2. the OpenAlex author record, whose affiliation history should include the institution.
Same name alone never counts: without an affiliation match the record is only "medium", and with no
affiliation data at all it is "low" and the writer may cite that advisor's papers but not facts about them.
"""
from ..tools.scholar import author_profile


def anchor_identity(adv: dict, institution: str, faculty_url: str) -> dict:
    sources = [{"type": "faculty_directory", "url": adv.get("profile_url") or faculty_url}]
    reasons: list[str] = []
    aid = adv.get("openalex_id")
    if not aid:
        return {"confidence": "low", "sources": sources, "reasons": ["no OpenAlex id"]}
    try:
        prof = author_profile(aid)
    except Exception as e:  # network/quota: do not block the run, just say what is missing
        return {"confidence": "low", "sources": sources, "reasons": [f"OpenAlex profile unavailable: {type(e).__name__}"]}

    inst = institution.lower()
    hits = [a for a in prof["affiliations"] if a["institution"] and inst in a["institution"].lower()]
    name_ok = _same_name(adv.get("name", ""), prof.get("name") or "")
    if not name_ok:
        reasons.append(f"OpenAlex name '{prof.get('name')}' differs from faculty-page name '{adv.get('name')}'")
    if hits:
        yrs = sorted({y for a in hits for y in a["years"]})
        span = f"{yrs[0]}–{yrs[-1]}" if yrs else "years unknown"
        sources.append({"type": "openalex_affiliation", "url": prof["url"], "detail": f"{hits[0]['institution']} ({span})"})
        confidence = "high" if name_ok else "medium"
    elif prof["affiliations"]:
        latest = prof["affiliations"][0]["institution"]
        reasons.append(f"OpenAlex affiliations do not list {institution}; latest is {latest}")
        sources.append({"type": "openalex_record", "url": prof["url"], "detail": f"latest affiliation {latest}"})
        confidence = "medium"
    else:
        reasons.append("OpenAlex record has no affiliation data")
        confidence = "low"
    return {"confidence": confidence, "sources": sources, "reasons": reasons}


def _same_name(a: str, b: str) -> bool:
    """Loose surname + first-initial comparison, tolerant of middle names and initials."""
    ta, tb = a.lower().replace(".", "").split(), b.lower().replace(".", "").split()
    if not ta or not tb:
        return False
    return ta[-1] == tb[-1] and ta[0][0] == tb[0][0]

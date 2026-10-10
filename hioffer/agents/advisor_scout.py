"""Advisor scout: match faculty to the applicant's interests, with cited recent papers."""
from ..llm import Tool, parse_json, run_tool_agent
from .identity import anchor_identity
from ..tools.scholar import FIND_AUTHOR, RECENT_WORKS
from ..tools.web import FETCH_PAGE

SYSTEM = """You find potential PhD advisors at ONE department for an applicant.
Steps:
1. fetch_page the faculty directory. Pick up to 6 faculty whose listed areas match the applicant's interests.
   If the directory is long, prefer names whose areas clearly match; do not fetch every profile.
2. For each pick: find_author (pass the institution as a hint) then recent_works (since 2024) for the best
   candidate (match on topics and affiliations; the "last known institution" may be a lab or company).
   Keep 2-4 papers that relate to the applicant's interests. Optionally fetch_page the professor's own page to
   check whether they say they are recruiting students.
3. Return the 3-5 best matches. An advisor with no recent_works result is useless downstream: try one more
   find_author spelling before giving up on them.

Evidence rules: "papers" may ONLY contain works returned by recent_works, with their exact OpenAlex ids
(they look like W4401042371). Papers you merely saw on a lab page go into "unverified_mentions" with the URL.
"takes_students" must be one of "yes", "no", "unknown" with the evidence quote and URL, or "unknown" when
nothing was found. Never invent papers or ids.

Return JSON:
{"department": name, "faculty_url": url,
 "advisors": [{"name", "openalex_id", "profile_url": url or null, "areas": [..],
               "match_reason": 2-3 sentences citing specific papers,
               "papers": [{"id","title","year","venue","url"}],
               "unverified_mentions": [{"title", "source_url"}],
               "takes_students": {"verdict": "yes|no|unknown", "evidence": quote or null, "source_url": url or null},
               "fit_score": 1-5}],
 "skipped": [{"name", "why"}]}"""


def scout_advisors(department: str, faculty_url: str, institution: str, interests: str, log=print) -> dict:
    # Collect every work OpenAlex actually returned in this run, so the output can be
    # filtered against ground truth instead of trusting the model's citations.
    verified: dict[str, dict] = {}

    def recent_works_recording(**kw):
        out = RECENT_WORKS.fn(**kw)
        for w in out.get("works", []):
            verified[w["id"]] = w
        return out

    recording_tool = Tool(RECENT_WORKS.name, RECENT_WORKS.description, RECENT_WORKS.parameters, recent_works_recording)
    text = run_tool_agent(
        name="advisor_scout",
        system=SYSTEM,
        user=f"Department: {department}\nInstitution (for OpenAlex filter): {institution}\n"
        f"Faculty directory: {faculty_url}\n\nApplicant's research interests:\n{interests}",
        tools=[FETCH_PAGE, FIND_AUTHOR, recording_tool],
        max_steps=24,
        log=log,
    )
    result = parse_json(text)
    dropped = 0
    kept_advisors = []
    for adv in result.get("advisors", []):
        keep, mentions = [], adv.get("unverified_mentions", [])
        for p in adv.get("papers", []):
            if p.get("id") in verified:
                keep.append({**verified[p["id"]], **{k: v for k, v in p.items() if v}})
            else:
                dropped += 1
                mentions.append({"title": p.get("title"), "source_url": p.get("url"), "why": "id not returned by OpenAlex"})
        adv["papers"], adv["unverified_mentions"] = keep, mentions
        if keep:
            adv["identity"] = anchor_identity(adv, institution, faculty_url)
            kept_advisors.append(adv)
        else:  # nothing citable: the writer would have to invent, so demote to skipped
            result.setdefault("skipped", []).append({"name": adv["name"], "why": "no OpenAlex-verified recent papers"})
    result["advisors"] = kept_advisors
    result["verification"] = {"openalex_works_seen": len(verified), "papers_dropped_as_unverified": dropped}
    log(f"  [advisor_scout] kept {len(kept_advisors)} advisors with OpenAlex-verified papers; dropped {dropped} unverified papers")
    return result

"""Writer: tailor the SOP, fit paragraphs and outreach emails for one program."""
import json

import neatlogs

from ..llm import complete_json

SYSTEM = """You write application materials for a PhD applicant. You may ONLY use:
- facts about the APPLICANT from the material library items (cite as [lib:<id>]),
- papers listed for the advisors, with their authors/venue/year exactly as given (cite as [paper:<id>]),
- what the advisor record says about an advisor's areas, lab, student recruiting and "connections" (co-author or
  alumni links to the applicant's circle; cite as [advisor:<name>]). A connection may be mentioned in an email only
  as a factual link ("my advisor X co-authored ... with you"), never as a claimed introduction or endorsement.
- requirements from the program facts.
Every sentence that states a fact about the applicant must cite [lib:..]; every sentence that states a fact about
an advisor must cite [paper:..] or [advisor:..]. Never cite a library item for a fact about a professor.
Do not invent project names, results, courses, papers, venues or conversations. Do not attribute a paper to an
advisor it is not listed under. Respect the word limit strictly.
Write in the applicant's own voice, concrete, no clichés ("ever since I was a child", "passion").

Return JSON:
{"fit_paragraphs": [{"advisor": name, "text": 90-140 words citing [paper:..] and [lib:..]}],
 "sop": {"text": full statement within the limit, "word_limit": int or null, "word_count": int},
 "emails": [{"advisor": name, "subject": str, "body": 120-180 words, polite, specific, asks whether they are
             taking students, mentions one paper, offers CV; ends with the applicant's name}],
 "changes_from_draft": [short bullets]}"""


@neatlogs.span(kind="AGENT", name="writer")
def write_materials(library: dict, program: dict, advisors: dict, feedback: list[str] | None = None) -> dict:
    lib_view = [
        {"id": i["id"], "type": i["type"], "key_facts": i["key_facts"], "text": i["text"][:6000]}
        for i in library["items"]
    ]
    word_limit = _sop_word_limit(program)
    adv_view = [
        {
            "name": a["name"], "areas": a.get("areas"), "match_reason": a.get("match_reason"),
            "takes_students": a.get("takes_students"), "profile_url": a.get("profile_url"),
            "connections": a.get("connections", []),
            "papers": [{k: p.get(k) for k in ("id", "title", "year", "venue", "authors")} for p in a["papers"]],
        }
        for a in advisors["advisors"]
    ]
    user = (
        f"PROGRAM FACTS:\n{json.dumps(program['facts'], ensure_ascii=False)}\n\n"
        f"SOP WORD LIMIT: {word_limit if word_limit else 'none stated; stay under 1000 words'}\n\n"
        f"ADVISORS (cite as [advisor:<name>] or [paper:<id>]):\n{json.dumps(adv_view, ensure_ascii=False)}\n\n"
        f"MATERIAL LIBRARY:\n{json.dumps(lib_view, ensure_ascii=False)}"
    )
    if feedback:
        user += "\n\nTHE PREVIOUS DRAFT FAILED VERIFICATION. Fix exactly these issues:\n- " + "\n- ".join(feedback)
    out = complete_json(SYSTEM, user, max_tokens=8000)
    out["sop"]["word_count"] = len(out["sop"]["text"].split())
    out["sop"]["word_limit"] = word_limit
    return out


def _sop_word_limit(program: dict) -> int | None:
    import re

    for f in program.get("facts", []):
        if f["key"] in ("statement_of_purpose", "research_statement"):
            m = re.search(r"(\d{3,4})\s*words?", f["value"] + " " + f.get("quote", ""), re.I)
            if m:
                return int(m.group(1))
    return None

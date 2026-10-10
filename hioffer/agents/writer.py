"""Writer: tailor the SOP, fit paragraphs and outreach emails for one program."""
import json

import neatlogs

from ..llm import complete_json

SYSTEM = """You write application materials for a PhD applicant. You may ONLY use:
- facts from the material library items (cite as [lib:<id>]),
- papers listed for the advisors (cite as [paper:<id>]),
- requirements from the program facts.
Every sentence that states a fact about the applicant or an advisor must end with a citation tag.
Do not invent results, courses, papers or conversations. Respect the word limit strictly.
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
    user = (
        f"PROGRAM FACTS:\n{json.dumps(program['facts'], ensure_ascii=False)}\n\n"
        f"SOP WORD LIMIT: {word_limit if word_limit else 'none stated; stay under 1000 words'}\n\n"
        f"ADVISORS:\n{json.dumps(advisors['advisors'], ensure_ascii=False)}\n\n"
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

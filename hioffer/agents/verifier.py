"""Verifier: deterministic checks first, then an LLM audit of claims against sources."""
import json
import re

import neatlogs

from ..llm import complete_json

AUDIT_SYSTEM = """You audit a PhD applicant's drafted materials against their sources.
Sources: LIBRARY items (facts about the applicant, cited [lib:id]); PAPERS (cited [paper:id], with authors,
venue, year and the advisor they are listed under); ADVISORS (areas, match_reason, takes_students evidence,
cited [advisor:name]).
Flag a sentence only when it states a fact that is (a) missing a citation tag, or (b) cited to a source that
does not contain it, or (c) attributes a paper to the wrong advisor, or (d) invents specifics (numbers, names,
project names, venues). A first-author "et al." plus venue/year that matches the paper record is fine.
Be lenient about phrasing and about the applicant's stated research goals.
Return JSON: {"issues": [{"where": "sop|fit:<advisor>|email:<advisor>", "sentence": str, "problem": str}]}"""

TAG = re.compile(r"\[(lib|paper|advisor):([^\]]+)\]")


@neatlogs.span(kind="GUARDRAIL", name="verifier")
def verify(library: dict, program: dict, advisors: dict, materials: dict) -> dict:
    issues: list[dict] = []
    lib_ids = {i["id"] for i in library["items"]}
    paper_ids = {p["id"] for a in advisors["advisors"] for p in a.get("papers", [])}
    advisor_names = {a["name"].lower() for a in advisors["advisors"]}

    # 1. Word limit.
    sop = materials["sop"]
    if sop.get("word_limit") and sop["word_count"] > sop["word_limit"]:
        issues.append({"check": "word_limit", "problem": f"SOP is {sop['word_count']} words, limit {sop['word_limit']}"})

    # 2. Citation tags must resolve.
    texts = {"sop": sop["text"]}
    texts.update({f"fit:{p['advisor']}": p["text"] for p in materials.get("fit_paragraphs", [])})
    texts.update({f"email:{e['advisor']}": e["body"] for e in materials.get("emails", [])})
    for where, text in texts.items():
        for kind, ident in TAG.findall(text):
            ok = (
                (kind == "lib" and f"lib:{ident}" in lib_ids)
                or (kind == "paper" and ident in paper_ids)
                or (kind == "advisor" and ident.strip().lower() in advisor_names)
            )
            if not ok:
                issues.append({"check": "citation", "where": where, "problem": f"unknown citation [{kind}:{ident}]"})
    if not TAG.search(sop["text"]):
        issues.append({"check": "citation", "where": "sop", "problem": "SOP has no citation tags at all"})

    # 3. Requirement coverage: each document the program marks as required must exist in the
    #    library (or be drafted). Missing files are applicant to-dos, not writer errors.
    have = {i["type"] for i in library["items"]} | {"sop"}
    for f in program.get("facts", []):
        need = {"cv": "cv", "writing_sample": "writing_sample", "research_statement": "research_statement"}.get(f["key"])
        if need and need not in have and f.get("required") == "yes":
            issues.append(
                {"check": "coverage", "fixable_by": "applicant", "problem": f"program requires {need} but library has none",
                 "source_url": f.get("source_url")}
            )

    # 4. LLM audit of claims vs sources.
    audit = complete_json(
        AUDIT_SYSTEM,
        "LIBRARY (ids and facts):\n"
        + json.dumps([{"id": i["id"], "key_facts": i["key_facts"]} for i in library["items"]], ensure_ascii=False)
        + "\n\nPAPERS:\n"
        + json.dumps(
            [
                {"id": p["id"], "title": p["title"], "authors": p.get("authors"), "venue": p.get("venue"),
                 "year": p.get("year"), "listed_under_advisor": a["name"]}
                for a in advisors["advisors"] for p in a["papers"]
            ],
            ensure_ascii=False,
        )
        + "\n\nADVISORS:\n"
        + json.dumps(
            [{"name": a["name"], "areas": a.get("areas"), "match_reason": a.get("match_reason"),
              "takes_students": a.get("takes_students")} for a in advisors["advisors"]],
            ensure_ascii=False,
        )
        + "\n\nDRAFTS:\n"
        + json.dumps(texts, ensure_ascii=False),
    )
    for it in audit.get("issues", []):
        issues.append({"check": "claim", **it})

    for it in issues:
        it.setdefault("fixable_by", "writer")
    writer_issues = [i for i in issues if i["fixable_by"] == "writer"]
    return {"passed": not writer_issues, "issues": issues, "writer_issues": writer_issues,
            "applicant_todos": [i for i in issues if i["fixable_by"] == "applicant"]}

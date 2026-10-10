"""Verifier: deterministic checks first, then an LLM audit of claims against sources."""
import json
import re

import neatlogs

from ..llm import complete_json

AUDIT_SYSTEM = """You audit a PhD applicant's drafted materials against their sources.
For each draft, find sentences that state a fact about the applicant or an advisor which is either
(a) missing a citation tag, or (b) cited to a source that does not support it.
Be strict about invented specifics (numbers, names, titles, venues) and lenient about phrasing.
Return JSON: {"issues": [{"where": "sop|fit:<advisor>|email:<advisor>", "sentence": str, "problem": str}]}"""

TAG = re.compile(r"\[(lib|paper):([^\]]+)\]")


@neatlogs.span(kind="GUARDRAIL", name="verifier")
def verify(library: dict, program: dict, advisors: dict, materials: dict) -> dict:
    issues: list[dict] = []
    lib_ids = {i["id"] for i in library["items"]}
    paper_ids = {p["id"] for a in advisors["advisors"] for p in a.get("papers", [])}

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
            ref = f"{kind}:{ident}" if kind == "lib" else ident
            if (kind == "lib" and ref not in lib_ids) or (kind == "paper" and ident not in paper_ids):
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
        + json.dumps([{"id": p["id"], "title": p["title"], "advisor": a["name"]} for a in advisors["advisors"] for p in a["papers"]], ensure_ascii=False)
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

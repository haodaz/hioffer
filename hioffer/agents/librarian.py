"""Librarian: turn the applicant's files into a structured material library."""
from pathlib import Path

import neatlogs

from ..llm import complete_json
from ..tools.files import read_file, word_count

SYSTEM = """You are the librarian of a PhD applicant's material library.
Given one file, return JSON:
{"type": one of ["cv","sop","research_statement","writing_sample","recommenders","interests","profile","other"],
 "title": short title,
 "summary": 2-3 sentences,
 "key_facts": [up to 12 concrete, checkable facts stated in the file, each one sentence
                (e.g. degrees, GPA, projects, papers, skills, awards, names of recommenders, research interests)]}
Only include facts actually present in the file. Never invent."""


@neatlogs.span(kind="AGENT", name="librarian")
def build_library(applicant_dir: Path) -> dict:
    items = []
    for p in sorted(Path(applicant_dir).iterdir()):
        if p.name.startswith(".") or p.suffix.lower() not in {".md", ".txt", ".pdf"} or p.name == "programs.yaml":
            continue
        text = read_file(p)
        meta = complete_json(SYSTEM, f"File name: {p.name}\n\n{text[:12000]}")
        items.append(
            {
                "id": f"lib:{p.stem}",
                "file": p.name,
                "word_count": word_count(text),
                "text": text,
                **meta,
            }
        )
    return {"items": items}

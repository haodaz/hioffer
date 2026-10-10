"""Root agent: plan the steps for a goal, run them with checkpoints, verify and revise."""
from pathlib import Path

import neatlogs
import yaml

from .agents.advisor_scout import scout_advisors
from .agents.librarian import build_library
from .agents.program_researcher import research_program
from .agents.verifier import verify
from .agents.writer import write_materials
from .state import Workspace

MAX_REVISIONS = 2


def slug(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")


@neatlogs.span(kind="WORKFLOW", name="prepare_applications")
def prepare_applications(applicant_dir: Path, workspace_root: Path, program_filter: list[str] | None = None, log=print) -> dict:
    applicant_dir = Path(applicant_dir)
    ws = Workspace(Path(workspace_root) / applicant_dir.name)
    programs = yaml.safe_load((applicant_dir / "programs.yaml").read_text())["programs"]
    if program_filter:
        programs = [p for p in programs if any(f.lower() in p["name"].lower() for f in program_filter)]

    # Step 1: material library (shared by all programs).
    if ws.has("library"):
        log("library: resume from checkpoint")
    else:
        log("library: reading applicant files")
        ws.save("library", build_library(applicant_dir))
    library = ws.load("library")
    interests = next((i["text"] for i in library["items"] if i["type"] == "interests"), "")
    if not interests:
        interests = "\n".join(f for i in library["items"] for f in i["key_facts"])

    summary = {"programs": []}
    for prog in programs:
        key = slug(prog["name"])
        log(f"\n=== {prog['name']} ===")

        # Step 2: requirements with sources.
        if not ws.has(f"{key}/requirements"):
            log("requirements: researching official pages")
            ws.save(f"{key}/requirements", research_program(prog["name"], prog["admissions_url"], log=log))
        requirements = ws.load(f"{key}/requirements")

        # Step 3: advisors with cited papers.
        if not ws.has(f"{key}/advisors"):
            log("advisors: scouting faculty + OpenAlex")
            ws.save(
                f"{key}/advisors",
                scout_advisors(prog["department"], prog["faculty_url"], prog["institution"], interests, log=log),
            )
        advisors = ws.load(f"{key}/advisors")

        # Step 4 + 5: write, verify, revise.
        feedback: list[str] = []
        for attempt in range(MAX_REVISIONS + 1):
            mkey = f"{key}/materials_v{attempt}"
            if not ws.has(mkey):
                log(f"writer: draft v{attempt}" + (" (revising)" if feedback else ""))
                ws.save(mkey, write_materials(library, requirements, advisors, feedback or None))
            materials = ws.load(mkey)
            vkey = f"{key}/verification_v{attempt}"
            if not ws.has(vkey):
                log(f"verifier: checking v{attempt}")
                ws.save(vkey, verify(library, requirements, advisors, materials))
            result = ws.load(vkey)
            if result["passed"]:
                log(f"verifier: v{attempt} passed")
                break
            feedback = [f"{i.get('where', i.get('check'))}: {i['problem']}" for i in result["writer_issues"]]
            log(f"verifier: v{attempt} failed with {len(feedback)} writer issue(s)")
        todos = [
            {"program": prog["name"], "task": t["problem"], "source_url": t.get("source_url"), "done": False}
            for t in result.get("applicant_todos", [])
        ]
        ws.save(f"{key}/final", {"materials_version": attempt, "passed": result["passed"], "issues": result["issues"], "todos": todos})
        summary["programs"].append(
            {
                "program": prog["name"],
                "facts": len(requirements.get("facts", [])),
                "not_found": requirements.get("not_found", []),
                "advisors": [a["name"] for a in advisors.get("advisors", [])],
                "materials_version": attempt,
                "passed": result["passed"],
                "open_issues": len(result["writer_issues"]),
                "applicant_todos": len(todos),
            }
        )
    ws.save("summary", summary)
    return summary

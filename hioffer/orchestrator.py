"""Root agent: plan the steps for a goal, run them with checkpoints, verify and revise."""
from pathlib import Path

import neatlogs

from .agents.advisor_scout import scout_advisors
from .agents.connector import find_connections
from .agents.librarian import build_library
from .agents.planner import merge_todos, plan_todos
from .agents.program_researcher import research_program
from .agents.verifier import verify
from .agents.writer import write_materials
from .llm import usage_summary
from .programs import load_programs
from .state import Workspace

MAX_REVISIONS = 2


def slug(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")


@neatlogs.span(kind="WORKFLOW", name="prepare_applications")
def prepare_applications(applicant_dir: Path, workspace_root: Path, program_filter: list[str] | None = None, log=print) -> dict:
    applicant_dir = Path(applicant_dir)
    ws = Workspace(Path(workspace_root) / applicant_dir.name)
    programs = load_programs(applicant_dir, ws.root)
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
        if not prog.get("admissions_url") or not prog.get("faculty_url"):
            log("skipped: program has no admissions/faculty URL yet (add them in chat)")
            summary["programs"].append({"program": prog["name"], "status": "blocked", "reason": "missing admissions_url or faculty_url"})
            continue
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

        # Step 3b: light relationship graph (co-authors, alumni) between the applicant's circle and each advisor.
        if not ws.has(f"{key}/advisors_connected"):
            log("connector: co-author / alumni links")
            try:
                ws.save(f"{key}/advisors_connected", find_connections(library, advisors, log=log))
            except Exception as e:  # a quota failure here must not block the application package
                log(f"connector: skipped ({e})")
                ws.save(f"{key}/advisors_connected", {**advisors, "connector_error": str(e)})
        advisors = ws.load(f"{key}/advisors_connected")

        if not advisors.get("advisors"):
            # No verified advisor means no honest fit paragraphs or emails: stop here and say so
            # instead of producing a package that "passes" with nothing in it.
            log("writer: skipped, no OpenAlex-verified advisors (re-run after the advisor stage succeeds)")
            ws.path(f"{key}/advisors").unlink(missing_ok=True)
            ws.path(f"{key}/advisors_connected").unlink(missing_ok=True)
            summary["programs"].append(
                {"program": prog["name"], "facts": len(requirements.get("facts", [])),
                 "not_found": requirements.get("not_found", []), "advisors": [], "status": "blocked",
                 "reason": advisors.get("connector_error") or "advisor scout returned no verified advisors"}
            )
            continue

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
                result = verify(library, requirements, advisors, materials)
                if result.get("repaired_citations"):
                    ws.save(mkey, materials)  # verifier repaired near-miss paper ids in place
                ws.save(vkey, result)
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

        # Step 6: dated to-dos for the human (outreach, letters, tests, fee + submit).
        log("planner: timeline")
        generated = plan_todos(prog["name"], requirements, advisors, materials)
        generated += [{"id": f"{key}-todo-{i}", "done": False, "kind": "applicant", **t} for i, t in enumerate(todos)]
        ws.save("todos", merge_todos(ws.load("todos", []), generated))
        summary["programs"].append(
            {
                "program": prog["name"],
                "facts": len(requirements.get("facts", [])),
                "not_found": requirements.get("not_found", []),
                "advisors": [a["name"] for a in advisors.get("advisors", [])],
                "materials_version": attempt,
                "status": "complete" if result["passed"] else "needs_review",
                "passed": result["passed"],
                "open_issues": len(result["writer_issues"]),
                "applicant_todos": len(todos),
            }
        )
    summary["usage"] = usage_summary()
    ws.save("summary", summary)
    return summary

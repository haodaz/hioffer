"""Planner: turn a finished program package into dated to-dos for the applicant.

Everything here is something only a human can do (email, ask, pay, submit). The deadline string from
the requirements is normalised to an ISO date with one cheap model call; the rest is arithmetic.
"""
import json
from datetime import date, timedelta

import neatlogs

from ..config import CHEAP_MODEL
from ..llm import complete_json

NORMALISE = """Given a program's deadline statement and today's date, return JSON
{"deadline": "YYYY-MM-DD" or null, "note": short caveat or ""}.
Pick the next occurrence of the deadline after today for a Fall intake. If the text gives a day and month
but no year, infer the year from today. If no date is stated, return null."""


@neatlogs.span(kind="AGENT", name="planner")
def plan_todos(program_name: str, requirements: dict, advisors: dict, materials: dict | None, today: date | None = None) -> list[dict]:
    today = today or date.today()
    facts = {f["key"]: f for f in requirements.get("facts", [])}
    deadline_fact = facts.get("deadline")
    deadline = None
    if deadline_fact:
        out = complete_json(NORMALISE, f"Today: {today.isoformat()}\nDeadline statement: {deadline_fact['value']}", model=CHEAP_MODEL, max_tokens=200)
        try:
            deadline = date.fromisoformat(out.get("deadline")) if out.get("deadline") else None
        except ValueError:
            deadline = None

    def d(days_before: int) -> str | None:
        return (deadline - timedelta(days=days_before)).isoformat() if deadline else None

    todos = []
    emails = {e["advisor"] for e in (materials or {}).get("emails", [])}
    for a in advisors.get("advisors", []):
        if a.get("takes_students", {}).get("verdict") == "no":
            continue
        todos.append({"task": f"Email {a['name']} ({'draft ready' if a['name'] in emails else 'no draft yet'})",
                      "program": program_name, "due": d(45), "kind": "outreach", "source_url": a.get("profile_url")})
    letters = facts.get("letters_of_recommendation")
    if letters:
        todos.append({"task": f"Ask recommenders: {letters['value']}", "program": program_name, "due": d(28),
                      "kind": "letters", "source_url": letters.get("source_url")})
        todos.append({"task": "Remind recommenders (letters due with the application)", "program": program_name,
                      "due": d(7), "kind": "letters", "source_url": letters.get("source_url")})
    tests = facts.get("toefl_ielts")
    if tests and tests.get("required") == "yes":
        todos.append({"task": f"Send English test scores: {tests['value'][:120]}", "program": program_name, "due": d(21),
                      "kind": "tests", "source_url": tests.get("source_url")})
    tr = facts.get("transcripts")
    if tr:
        todos.append({"task": f"Upload transcripts: {tr['value'][:120]}", "program": program_name, "due": d(14),
                      "kind": "documents", "source_url": tr.get("source_url")})
    fee = facts.get("application_fee")
    todos.append({"task": f"Pay application fee{(' (' + fee['value'][:60] + ')') if fee else ''} and submit",
                  "program": program_name, "due": deadline.isoformat() if deadline else None, "kind": "submit",
                  "source_url": (fee or deadline_fact or {}).get("source_url")})
    for i, t in enumerate(todos):
        t["id"] = f"{_slug(program_name)}-{i + 1}"
        t["done"] = False
    return todos


def _slug(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")


def merge_todos(existing: list[dict], new: list[dict]) -> list[dict]:
    """Keep the applicant's own to-dos and their done flags; replace generated ones for the program."""
    by_id = {t["id"]: t for t in existing}
    out = [t for t in existing if not any(t["id"] == n["id"] for n in new)]
    for n in new:
        if n["id"] in by_id:
            n["done"] = by_id[n["id"]].get("done", False)
        out.append(n)
    return out

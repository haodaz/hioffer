"""Mock interview: what this advisor or committee would plausibly ask, grounded in the applicant's own
materials and the advisor's verified papers. One plan per advisor (cached); one short evaluation per answer.

It never claims to know the real interview. Stages mirror how PhD interviews usually go:
fit → your project in depth → the advisor's papers → methods → future plans → logistics.
"""
import json

import neatlogs

from ..llm import complete_json

STAGES = ["fit", "your_project", "advisor_papers", "methods", "future", "logistics"]

PLAN = """You prepare a PhD applicant for an interview with ONE professor. Using only the applicant's material
library and the professor's listed papers, write 7 questions across the stages
fit, your_project, advisor_papers, methods, future, logistics (at least one per stage; two for your_project).
Each question must be something this professor could plausibly ask given the papers and the applicant's facts;
cite which fact or paper it comes from. Return JSON:
{"advisor": name, "questions": [{"id": "q1", "stage": stage, "question": str,
  "why": one sentence on why they'd ask, citing [lib:..] or [paper:..],
  "strong_answer_includes": [3 short bullets]}]}"""

EVAL = """You are coaching a PhD applicant after one interview answer. Be concrete, not polite.
Return JSON:
{"scores": {"fit": int 1-5, "depth": int 1-5, "clarity": int 1-5},
 "impression_delta": int from -3 to +3 (how the professor's impression moved after this answer),
 "impression_note": 6-10 words on why it moved,
 "good": [1-3 short bullets: what worked, quoting the applicant's words where useful],
 "improve": [1-3 short bullets: what to add or cut, each actionable],
 "model_answer_hint": one sentence sketching what a strong version would have said,
 "feedback": two spoken sentences the professor might say back (natural, no bullet points),
 "follow_up": one natural follow-up question}"""


@neatlogs.span(kind="AGENT", name="interview_plan")
def plan_interview(library: dict, advisor: dict, program_name: str) -> dict:
    lib = [{"id": i["id"], "type": i["type"], "key_facts": i["key_facts"]} for i in library["items"]]
    papers = [{"id": p["id"], "title": p["title"], "venue": p.get("venue"), "year": p.get("year")} for p in advisor.get("papers", [])]
    out = complete_json(
        PLAN,
        f"PROGRAM: {program_name}\nPROFESSOR: {advisor['name']} — areas: {', '.join(advisor.get('areas', []))}\n"
        f"MATCH REASON (from research): {advisor.get('match_reason', '')}\n\nPAPERS:\n{json.dumps(papers, ensure_ascii=False)}\n\n"
        f"APPLICANT LIBRARY:\n{json.dumps(lib, ensure_ascii=False)}",
        max_tokens=2500,
    )
    out["program"] = program_name
    out["advisor"] = advisor["name"]
    out["stages"] = STAGES
    out["caveat"] = "Plausible questions from your materials and this professor's papers, not the real interview."
    return out


@neatlogs.span(kind="AGENT", name="interview_eval")
def evaluate_answer(question: dict, answer: str, advisor_name: str) -> dict:
    return complete_json(
        EVAL,
        f"PROFESSOR: {advisor_name}\nSTAGE: {question['stage']}\nQUESTION: {question['question']}\n"
        f"A STRONG ANSWER INCLUDES: {question.get('strong_answer_includes')}\n\nAPPLICANT'S ANSWER:\n{answer[:1500]}",
        max_tokens=500,
    )

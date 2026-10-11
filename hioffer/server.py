"""HTTP API for the web UI.

- GET  /api/applicants/{id}/state   everything the panels show (read from the workspace JSON files)
- POST /api/applicants/{id}/chat    root chat agent; Server-Sent Events: delta | tool_start | tool_log |
                                    tool_end | card | final | error
- POST /api/applicants/{id}/todos   add / toggle a to-do (deterministic, no model)

Run:  uv run uvicorn hioffer.server:app --reload --port 8000
"""
import asyncio
import json
import queue
import threading
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from datetime import date

from . import config
from .accounts import applicant_dir, create_applicant, profile_name, resolve
from .agents.decider import compare_offers
from .agents.interview import evaluate_answer, plan_interview
from .agents.places import build_places, build_rankings
from .chat import ChatAgent
from .programs import load_programs
from .state import Workspace

APPLICANTS_DIR = Path("examples/applicants")
WORKSPACE_DIR = Path("workspace")

config.init_tracing(tags=["server"])
app = FastAPI(title="hioffer")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _dir(applicant: str) -> Path:
    d = applicant_dir(applicant)
    if not d:
        raise HTTPException(404, "unknown applicant")
    return d


def _ws(applicant: str) -> Workspace:
    _dir(applicant)
    return Workspace(WORKSPACE_DIR / applicant)


def require_invite(applicant: str, x_invite: str | None = Header(default=None)) -> str:
    """Every applicant route needs the invite code that maps to that applicant."""
    if resolve(x_invite or "") != applicant:
        raise HTTPException(401, "invite code does not match this applicant")
    return applicant


class LoginIn(BaseModel):
    code: str


@app.post("/api/login")
def login(body: LoginIn) -> dict:
    applicant = resolve(body.code)
    if not applicant:
        raise HTTPException(401, "unknown invite code")
    return {"applicant": applicant, "name": profile_name(applicant), "code": body.code.strip().upper()}


class ApplicantFile(BaseModel):
    name: str
    content: str


class ProgramIn(BaseModel):
    name: str
    short: str | None = None
    institution: str
    department: str | None = None
    admissions_url: str | None = None
    faculty_url: str | None = None


class CreateIn(BaseModel):
    name: str
    files: list[ApplicantFile] = []
    programs: list[ProgramIn] = []


@app.post("/api/applicants")
def create(body: CreateIn) -> dict:
    """Create an applicant from pasted materials; returns the invite code. No model calls."""
    if not body.name.strip():
        raise HTTPException(400, "name required")
    return create_applicant(body.name.strip(), [f.model_dump() for f in body.files], [p.model_dump(exclude_none=True) for p in body.programs])


def _latest(ws: Workspace, key: str, prefix: str) -> Any:
    d = ws.root / key
    if not d.exists():
        return None
    versions = sorted(p for p in d.glob(f"{prefix}_v*.json"))
    return json.loads(versions[-1].read_text()) if versions else None


def build_state(applicant: str) -> dict:
    ws = _ws(applicant)
    programs_cfg = load_programs(_dir(applicant), ws.root)
    library = ws.load("library", {"items": []})
    programs = []
    for p in programs_cfg:
        key = "".join(c if c.isalnum() else "-" for c in p["name"].lower()).strip("-")
        advisors = ws.load(f"{key}/advisors_connected") or ws.load(f"{key}/advisors")
        programs.append(
            {
                **p,
                "key": key,
                "requirements": ws.load(f"{key}/requirements"),
                "advisors": advisors,
                "materials": _latest(ws, key, "materials"),
                "verification": _latest(ws, key, "verification"),
                "final": ws.load(f"{key}/final"),
            }
        )
    return {
        "applicant": applicant,
        "applicant_name": profile_name(applicant),
        "library": [{k: v for k, v in i.items() if k != "text"} for i in library["items"]],
        "programs": programs,
        "todos": ws.load("todos", []),
        "signals": ws.load("signals", []),
        "offers": ws.load("offers", []),
        "comparison": compare_offers(
            ws.load("offers", []),
            {p["name"]: (p["advisors"] or {}) for p in programs},
            ws.load("signals", []),
        ),
        "places": ws.load("places", {}),
        "rankings": ws.load("rankings", {}),
        "summary": ws.load("summary"),
    }


@app.post("/api/applicants/{applicant}/rankings")
def refresh_rankings(applicant: str, _auth: str = Depends(require_invite)) -> dict:
    """Approximate rankings for every institution in the program list and the latest recommendations."""
    ws = _ws(applicant)
    names = [p["institution"] for p in load_programs(_dir(applicant), ws.root)]
    rec = ws.load("recommendations") or {}
    names += [it["institution"] for items in rec.get("tiers", {}).values() for it in items]
    rankings = build_rankings(list(dict.fromkeys(names)), ws.load("rankings", {}))
    ws.save("rankings", rankings)
    return rankings


@app.post("/api/applicants/{applicant}/places")
def refresh_places(applicant: str, _auth: str = Depends(require_invite)) -> dict:
    """Fill in location, climate and living notes for programs that lack them (cheap; cached)."""
    ws = _ws(applicant)
    programs = load_programs(_dir(applicant), ws.root)
    places = build_places(programs, ws.load("places", {}), log=lambda s: None)
    ws.save("places", places)
    return places


class InterviewStart(BaseModel):
    program: str
    advisor: str


def _interview_key(program: str, advisor: str) -> str:
    slug = lambda s: "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")
    return f"interviews/{slug(program)}--{slug(advisor)}"


@app.post("/api/applicants/{applicant}/interview/plan")
def interview_plan(applicant: str, body: InterviewStart, _auth: str = Depends(require_invite)) -> dict:
    ws = _ws(applicant)
    key = _interview_key(body.program, body.advisor)
    cached = ws.load(key)
    if cached:
        return cached
    programs = load_programs(_dir(applicant), ws.root)
    prog = next((p for p in programs if p["name"] == body.program), None)
    if not prog:
        raise HTTPException(404, "unknown program")
    k = "".join(c if c.isalnum() else "-" for c in prog["name"].lower()).strip("-")
    adv = (ws.load(f"{k}/advisors_connected") or ws.load(f"{k}/advisors") or {}).get("advisors", [])
    advisor = next((a for a in adv if a["name"] == body.advisor), None)
    if not advisor:
        raise HTTPException(404, "unknown advisor")
    plan = plan_interview(ws.load("library"), advisor, prog["name"])
    plan["answers"] = []
    ws.save(key, plan)
    return plan


class InterviewAnswer(BaseModel):
    program: str
    advisor: str
    question_id: str
    answer: str


MAX_EVALS = 16


@app.post("/api/applicants/{applicant}/interview/answer")
def interview_answer(applicant: str, body: InterviewAnswer, _auth: str = Depends(require_invite)) -> dict:
    ws = _ws(applicant)
    key = _interview_key(body.program, body.advisor)
    plan = ws.load(key)
    if not plan:
        raise HTTPException(404, "no interview plan yet")
    if len(plan.get("answers", [])) >= MAX_EVALS:
        raise HTTPException(429, "evaluation limit reached for this interview")
    q = next((x for x in plan["questions"] if x["id"] == body.question_id), None)
    if not q:
        raise HTTPException(404, "unknown question")
    ev = evaluate_answer(q, body.answer, plan["advisor"])
    rec = {"question_id": q["id"], "answer": body.answer[:1500], **ev}
    plan.setdefault("answers", []).append(rec)
    ws.save(key, plan)
    return rec


class Signal(BaseModel):
    id: str | None = None
    program: str
    advisor: str | None = None
    kind: str  # email_sent | reply_positive | reply_neutral | reply_negative | interview | waitlist | admit | reject | funding_offer
    date: str | None = None
    note: str | None = None


@app.post("/api/applicants/{applicant}/signals")
def add_signal(applicant: str, sig: Signal, _auth: str = Depends(require_invite)) -> list:
    ws = _ws(applicant)
    signals = ws.load("signals", [])
    rec = sig.model_dump()
    rec["id"] = rec["id"] or f"s{len(signals) + 1}"
    rec["date"] = rec["date"] or date.today().isoformat()
    signals = [s for s in signals if s["id"] != rec["id"]] + [rec]
    ws.save("signals", signals)
    return signals


class Offer(BaseModel):
    id: str | None = None
    program: str
    advisor: str | None = None
    stipend_usd: int | None = None
    years_guaranteed: int | None = None
    respond_by: str | None = None
    note: str | None = None


@app.post("/api/applicants/{applicant}/offers")
def upsert_offer(applicant: str, offer: Offer, _auth: str = Depends(require_invite)) -> list:
    ws = _ws(applicant)
    offers = ws.load("offers", [])
    rec = offer.model_dump()
    rec["id"] = rec["id"] or f"o{len(offers) + 1}"
    offers = [o for o in offers if o["id"] != rec["id"]] + [rec]
    ws.save("offers", offers)
    return offers


@app.get("/api/applicants/{applicant}/state")
def get_state(applicant: str, _auth: str = Depends(require_invite)) -> dict:
    return build_state(applicant)


class Todo(BaseModel):
    id: str | None = None
    task: str | None = None
    program: str | None = None
    due: str | None = None
    done: bool | None = None


@app.post("/api/applicants/{applicant}/todos")
def upsert_todo(applicant: str, todo: Todo, _auth: str = Depends(require_invite)) -> list:
    ws = _ws(applicant)
    todos = ws.load("todos", [])
    if todo.id:
        for t in todos:
            if t["id"] == todo.id:
                t.update({k: v for k, v in todo.model_dump().items() if v is not None})
    else:
        todos.append({"id": f"t{len(todos) + 1}", "task": todo.task, "program": todo.program, "due": todo.due, "done": False})
    ws.save("todos", todos)
    return todos


class ChatIn(BaseModel):
    message: str
    history: list[dict] = []
    lang: str = "en"


@app.post("/api/applicants/{applicant}/chat")
async def chat(applicant: str, body: ChatIn, _auth: str = Depends(require_invite)):
    _ws(applicant)
    q: queue.Queue = queue.Queue()
    agent = ChatAgent(applicant, _dir(applicant), WORKSPACE_DIR / applicant, emit=q.put, lang=body.lang)

    def run():
        try:
            agent.respond(body.message, body.history)
        except Exception as e:  # surface, never hang the stream
            q.put({"type": "error", "message": f"{type(e).__name__}: {e}"})
        finally:
            q.put(None)

    threading.Thread(target=run, daemon=True).start()

    async def events():
        loop = asyncio.get_event_loop()
        while True:
            ev = await loop.run_in_executor(None, q.get)
            if ev is None:
                break
            yield f"event: {ev['type']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

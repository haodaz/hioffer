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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from datetime import date

from . import config
from .agents.decider import compare_offers
from .chat import ChatAgent
from .programs import load_programs
from .state import Workspace

APPLICANTS_DIR = Path("examples/applicants")
WORKSPACE_DIR = Path("workspace")

config.init_tracing(tags=["server"])
app = FastAPI(title="hioffer")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _ws(applicant: str) -> Workspace:
    if not (APPLICANTS_DIR / applicant).exists():
        raise HTTPException(404, "unknown applicant")
    return Workspace(WORKSPACE_DIR / applicant)


def _latest(ws: Workspace, key: str, prefix: str) -> Any:
    d = ws.root / key
    if not d.exists():
        return None
    versions = sorted(p for p in d.glob(f"{prefix}_v*.json"))
    return json.loads(versions[-1].read_text()) if versions else None


def build_state(applicant: str) -> dict:
    ws = _ws(applicant)
    programs_cfg = load_programs(APPLICANTS_DIR / applicant, ws.root)
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
        "summary": ws.load("summary"),
    }


class Signal(BaseModel):
    id: str | None = None
    program: str
    advisor: str | None = None
    kind: str  # email_sent | reply_positive | reply_neutral | reply_negative | interview | waitlist | admit | reject | funding_offer
    date: str | None = None
    note: str | None = None


@app.post("/api/applicants/{applicant}/signals")
def add_signal(applicant: str, sig: Signal) -> list:
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
def upsert_offer(applicant: str, offer: Offer) -> list:
    ws = _ws(applicant)
    offers = ws.load("offers", [])
    rec = offer.model_dump()
    rec["id"] = rec["id"] or f"o{len(offers) + 1}"
    offers = [o for o in offers if o["id"] != rec["id"]] + [rec]
    ws.save("offers", offers)
    return offers


@app.get("/api/applicants/{applicant}/state")
def get_state(applicant: str) -> dict:
    return build_state(applicant)


class Todo(BaseModel):
    id: str | None = None
    task: str | None = None
    program: str | None = None
    due: str | None = None
    done: bool | None = None


@app.post("/api/applicants/{applicant}/todos")
def upsert_todo(applicant: str, todo: Todo) -> list:
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
async def chat(applicant: str, body: ChatIn):
    _ws(applicant)
    q: queue.Queue = queue.Queue()
    agent = ChatAgent(applicant, APPLICANTS_DIR / applicant, WORKSPACE_DIR / applicant, emit=q.put, lang=body.lang)

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

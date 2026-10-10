"""Root chat agent: talks, and "speaks in cards".

The model decides which tool to call; tools are deterministic reads/writes of the workspace or the
full pipeline. Every tool result that has a visual form is also emitted as a `card` event, so the UI
renders it as an interactive card next to the model's short text reply.
"""
import json
from pathlib import Path
from typing import Callable

import neatlogs
import yaml

from .llm import Tool, _create, parse_json  # noqa: F401
from .orchestrator import prepare_applications, slug
from .state import Workspace

SYSTEM = """You are hioffer, a PhD-application agent. You help ONE applicant prepare applications:
find programs and their official requirements, find advisors whose recent papers match, assemble and tailor
materials, keep a to-do timeline, log signals (replies, interviews, admits) and compare offers with visible
weights. The applicant sends emails, pays fees and submits; you never do. Offer comparison is decision support,
not advice: show the table and the trade-offs, let the applicant decide.

Style: short, concrete, warm but not gushing. Reply in {lang_name}. When a tool returns data the UI shows it as a
card, so do not repeat the card's contents in prose; add only what the card does not say (what to do next, caveats,
one question if needed). Never invent facts: everything about programs and advisors comes from the tools, with
sources. If something is unknown, say so.

Expensive actions (run_prepare) must be confirmed: call it with confirmed=false first to show a confirm card,
and only with confirmed=true after the applicant says yes."""

LANG_NAMES = {"en": "English", "zh": "简体中文"}


class ChatAgent:
    def __init__(self, applicant: str, applicant_dir: Path, workspace_dir: Path, emit: Callable[[dict], None], lang: str = "en"):
        self.applicant = applicant
        self.applicant_dir = applicant_dir
        self.ws = Workspace(workspace_dir)
        self.emit = emit
        self.lang = lang if lang in LANG_NAMES else "en"
        self.programs = yaml.safe_load((applicant_dir / "programs.yaml").read_text())["programs"]
        self.tools = [
            Tool("show_programs", "List the applicant's target programs and their status.", {"type": "object", "properties": {}}, self.show_programs),
            Tool("show_requirements", "Official requirements of one program with sources.", _prog_params(), self.show_requirements),
            Tool("show_advisors", "Matched advisors of one program with cited papers and connections.", _prog_params(), self.show_advisors),
            Tool("show_materials", "Drafted materials for one program (SOP, fit paragraphs, outreach emails).", _prog_params(), self.show_materials),
            Tool("show_library", "The applicant's material library.", {"type": "object", "properties": {}}, self.show_library),
            Tool("show_todos", "The applicant's to-do list / timeline.", {"type": "object", "properties": {}}, self.show_todos),
            Tool(
                "add_todo", "Add a to-do for the applicant (things only a human can do: send email, pay fee, submit, remind recommender).",
                {"type": "object", "properties": {"task": {"type": "string"}, "program": {"type": "string"}, "due": {"type": "string", "description": "YYYY-MM-DD or empty"}}, "required": ["task"]},
                self.add_todo,
            ),
            Tool("show_signals", "Outreach / admissions signals logged so far (emails sent, replies, interviews, admits).", {"type": "object", "properties": {}}, self.show_signals),
            Tool(
                "log_signal", "Record a signal the applicant reports: an email they sent, a reply, an interview, a waitlist, an admit, a reject or a funding offer.",
                {"type": "object", "properties": {
                    "program": {"type": "string"}, "advisor": {"type": "string"},
                    "kind": {"type": "string", "enum": ["email_sent", "reply_positive", "reply_neutral", "reply_negative", "interview", "waitlist", "admit", "reject", "funding_offer"]},
                    "note": {"type": "string"}, "date": {"type": "string", "description": "YYYY-MM-DD, default today"}},
                 "required": ["program", "kind"]},
                self.log_signal,
            ),
            Tool(
                "add_offer", "Record an admission offer the applicant received (stipend, guaranteed years, response deadline).",
                {"type": "object", "properties": {"program": {"type": "string"}, "advisor": {"type": "string"}, "stipend_usd": {"type": "integer"},
                                                  "years_guaranteed": {"type": "integer"}, "respond_by": {"type": "string"}, "note": {"type": "string"}},
                 "required": ["program"]},
                self.add_offer,
            ),
            Tool("compare_offers", "Rank the recorded offers with transparent weights (advisor fit, funding, signals, guarantee).", {"type": "object", "properties": {}}, self.compare_offers),
            Tool(
                "run_prepare", "Run the full pipeline for one program (requirements → advisors → connections → draft → verify). Costs money and minutes.",
                {"type": "object", "properties": {"program": {"type": "string"}, "confirmed": {"type": "boolean"}}, "required": ["program", "confirmed"]},
                self.run_prepare,
            ),
        ]

    # ---- tools -------------------------------------------------------------------------------
    def _prog(self, program: str) -> dict:
        q = program.lower().strip()
        for p in self.programs:  # exact-ish first: short alias, then name / institution substring
            if q == p.get("short", "").lower() or q in (p["name"].lower(), slug(p["name"])):
                return p
        for p in self.programs:
            hay = " ".join([p["name"], p.get("institution", ""), p.get("short", "")]).lower()
            if q in hay or all(tok in hay for tok in q.split()):
                return p
        raise ValueError(
            f"No program matches '{program}'. The applicant's programs are exactly: "
            + "; ".join(f"{p['name']} (short: {p.get('short', '')})" for p in self.programs)
            + ". Ask the applicant which one they mean; do not guess."
        )

    def show_programs(self) -> dict:
        rows = []
        for p in self.programs:
            k = slug(p["name"])
            final = self.ws.load(f"{k}/final")
            adv = self.ws.load(f"{k}/advisors_connected") or self.ws.load(f"{k}/advisors") or {}
            req = self.ws.load(f"{k}/requirements") or {}
            deadline = next((f["value"] for f in req.get("facts", []) if f["key"] == "deadline"), None)
            rows.append({"name": p["name"], "key": k, "deadline": deadline, "advisors": len(adv.get("advisors", [])),
                         "facts": len(req.get("facts", [])), "status": "complete" if final and final.get("passed") else ("needs_review" if final else ("researched" if req else "not_started"))})
        self.card("programs", {"programs": rows})
        return {"programs": rows}

    def show_requirements(self, program: str) -> dict:
        p = self._prog(program)
        req = self.ws.load(f"{slug(p['name'])}/requirements")
        if not req:
            return {"status": "not researched yet; offer run_prepare"}
        self.card("requirements", {"program": p["name"], **req})
        return {"program": p["name"], "facts": [{k: f[k] for k in ("key", "required", "value") if k in f} for f in req["facts"]], "not_found": req.get("not_found")}

    def show_advisors(self, program: str) -> dict:
        p = self._prog(program)
        k = slug(p["name"])
        adv = self.ws.load(f"{k}/advisors_connected") or self.ws.load(f"{k}/advisors")
        if not adv:
            return {"status": "not scouted yet; offer run_prepare"}
        for a in adv["advisors"]:
            self.card("advisor", {"program": p["name"], **a})
        return {"program": p["name"], "advisors": [{"name": a["name"], "fit_score": a["fit_score"], "takes_students": a["takes_students"]["verdict"], "papers": len(a["papers"]), "connections": len(a.get("connections", []))} for a in adv["advisors"]], "skipped": adv.get("skipped", [])}

    def show_materials(self, program: str) -> dict:
        p = self._prog(program)
        k = slug(p["name"])
        versions = sorted((self.ws.root / k).glob("materials_v*.json")) if (self.ws.root / k).exists() else []
        if not versions:
            return {"status": "nothing drafted yet; offer run_prepare"}
        m = json.loads(versions[-1].read_text())
        v = self.ws.load(f"{k}/verification_v{len(versions) - 1}") or {}
        self.card("materials", {"program": p["name"], "version": len(versions) - 1, "verification": v, **m})
        return {"program": p["name"], "sop_words": m["sop"]["word_count"], "word_limit": m["sop"]["word_limit"], "fit_paragraphs": [f["advisor"] for f in m["fit_paragraphs"]], "emails": [e["advisor"] for e in m["emails"]], "verification_passed": v.get("passed"), "open_issues": len(v.get("writer_issues", []))}

    def show_library(self) -> dict:
        lib = self.ws.load("library", {"items": []})
        items = [{k: v for k, v in i.items() if k != "text"} for i in lib["items"]]
        self.card("library", {"items": items})
        return {"items": [{"id": i["id"], "type": i["type"], "title": i["title"], "words": i["word_count"]} for i in items]}

    def show_todos(self) -> dict:
        todos = self.ws.load("todos", [])
        self.card("todos", {"todos": todos})
        return {"todos": todos}

    def add_todo(self, task: str, program: str = "", due: str = "") -> dict:
        todos = self.ws.load("todos", [])
        t = {"id": f"t{len(todos) + 1}", "task": task, "program": program, "due": due or None, "done": False}
        todos.append(t)
        self.ws.save("todos", todos)
        self.card("todos", {"todos": todos, "added": t["id"]})
        return {"added": t}

    def show_signals(self) -> dict:
        signals = self.ws.load("signals", [])
        self.card("signals", {"signals": signals})
        return {"signals": signals}

    def log_signal(self, program: str, kind: str, advisor: str = "", note: str = "", date: str = "") -> dict:
        from datetime import date as _date

        p = self._prog(program)
        signals = self.ws.load("signals", [])
        rec = {"id": f"s{len(signals) + 1}", "date": date or _date.today().isoformat(), "program": p["name"],
               "advisor": advisor or None, "kind": kind, "note": note}
        signals.append(rec)
        self.ws.save("signals", signals)
        self.card("signals", {"signals": signals, "added": rec["id"]})
        return {"added": rec}

    def add_offer(self, program: str, advisor: str = "", stipend_usd: int | None = None, years_guaranteed: int | None = None, respond_by: str = "", note: str = "") -> dict:
        p = self._prog(program)
        offers = self.ws.load("offers", [])
        rec = {"id": f"o{len(offers) + 1}", "program": p["name"], "advisor": advisor or None, "stipend_usd": stipend_usd,
               "years_guaranteed": years_guaranteed, "respond_by": respond_by or None, "note": note}
        offers.append(rec)
        self.ws.save("offers", offers)
        return {"added": rec, **self.compare_offers()}

    def compare_offers(self) -> dict:
        from .agents.decider import compare_offers

        offers = self.ws.load("offers", [])
        adv = {p["name"]: (self.ws.load(f"{slug(p['name'])}/advisors_connected") or self.ws.load(f"{slug(p['name'])}/advisors") or {}) for p in self.programs}
        cmp = compare_offers(offers, adv, self.ws.load("signals", []))
        self.card("offers", cmp)
        return {"weights": cmp["weights"], "ranked": [{"program": r["program"], "total": r["total"], "reasons": r["reasons"]} for r in cmp["ranked"]]}

    def run_prepare(self, program: str, confirmed: bool) -> dict:
        p = self._prog(program)
        if not confirmed:
            self.card("confirm", {"action": "run_prepare", "program": p["name"],
                                  "steps": ["requirements", "advisors", "connections", "draft", "verify"],
                                  "note": "Uses the model budget and takes a few minutes. Finished steps are kept if it is interrupted."})
            return {"status": "awaiting confirmation"}
        summary = prepare_applications(self.applicant_dir, self.ws.root.parent, [p["name"]], log=self._log)
        self.show_programs()
        return summary

    # ---- plumbing ----------------------------------------------------------------------------
    def card(self, kind: str, data: dict) -> None:
        self.emit({"type": "card", "card": {"kind": kind, **data}})

    def _context(self) -> str:
        """Compact facts the agent should not have to ask about: programs, their aliases, matched advisors."""
        lines = []
        for p in self.programs:
            k = slug(p["name"])
            adv = self.ws.load(f"{k}/advisors_connected") or self.ws.load(f"{k}/advisors") or {}
            names = ", ".join(a["name"] for a in adv.get("advisors", [])) or "none yet"
            lines.append(f"- {p['name']} (short: {p.get('short', '')}; institution: {p.get('institution', '')}) — advisors: {names}")
        return "\n\nAPPLICANT'S PROGRAMS AND MATCHED ADVISORS (resolve names to programs yourself):\n" + "\n".join(lines)

    def _log(self, line: str) -> None:
        self.emit({"type": "tool_log", "text": line.strip()})

    @neatlogs.span(kind="AGENT", name="chat")
    def respond(self, message: str, history: list[dict]) -> str:
        from .config import MODEL

        by_name = {t.name: t for t in self.tools}
        messages = [{"role": "system", "content": SYSTEM.format(lang_name=LANG_NAMES[self.lang]) + self._context()}]
        messages += [{"role": h["role"], "content": h["content"]} for h in history[-12:] if h.get("role") in ("user", "assistant") and h.get("content")]
        messages.append({"role": "user", "content": message})
        for _ in range(6):
            resp = _create(model=MODEL, max_tokens=1500, messages=messages, tools=[t.spec() for t in self.tools])
            msg = resp.choices[0].message
            if not msg.tool_calls:
                break
            messages.append(msg.model_dump(exclude_none=True))
            for call in msg.tool_calls:
                tool = by_name[call.function.name]
                args = json.loads(call.function.arguments or "{}")
                self.emit({"type": "tool_start", "name": tool.name, "args": args})
                with neatlogs.trace(tool.name, kind="TOOL") as span:
                    span.set_attribute("tool.args", json.dumps(args)[:1000])
                    try:
                        out = tool.fn(**args)
                    except Exception as e:
                        out = {"error": f"{type(e).__name__}: {e}"}
                self.emit({"type": "tool_end", "name": tool.name})
                messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(out, ensure_ascii=False)[:12000]})
        text = msg.content or ""
        self.emit({"type": "delta", "text": text})
        self.emit({"type": "final", "text": text})
        return text


def _prog_params() -> dict:
    return {"type": "object", "properties": {"program": {"type": "string", "description": "Program name or part of it"}}, "required": ["program"]}

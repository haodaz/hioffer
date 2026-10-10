"""Thin model helpers: JSON completions and a tool-calling agent loop.

Every agent run is a neatlogs AGENT span; every tool execution is a TOOL span,
so the trace tree mirrors the orchestration.
"""
import json
import re
from dataclasses import dataclass
from typing import Any, Callable

import neatlogs

from .config import CHEAP_MODEL, MODEL, client


def parse_json(text: str, repair: bool = True) -> Any:
    """Parse JSON from a model reply, tolerating ``` fences and leading prose.

    If it still does not parse (typically unescaped quotes inside quoted source text),
    ask the cheap model to repair it once. The repair is its own span in the trace.
    """
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0] or [0])
    try:
        return json.loads(text[start:])
    except json.JSONDecodeError as e:
        if not repair:
            raise
        with neatlogs.trace("repair_json", kind="CHAIN") as span:
            span.set_attribute("error", str(e))
            fixed = complete(
                "You fix malformed JSON. Return the same content as strictly valid JSON only. "
                "Escape quotes inside strings. Do not add, drop or reword any content.",
                text[start:],
                model=CHEAP_MODEL,
                max_tokens=8000,
            )
        return parse_json(fixed, repair=False)


# Rough list prices per million tokens (input, output) used for a local cost estimate per run.
# neatlogs holds the authoritative numbers; this is for the console summary and the cfo.ai model.
PRICES = {"claude-sonnet-4.6": (3.0, 15.0), "claude-opus-4.6": (15.0, 75.0), "claude-haiku": (1.0, 5.0)}
USAGE: dict[str, dict] = {}


def _record_usage(model: str, resp) -> None:
    u = getattr(resp, "usage", None)
    if not u:
        return
    slot = USAGE.setdefault(model, {"calls": 0, "input_tokens": 0, "output_tokens": 0})
    slot["calls"] += 1
    slot["input_tokens"] += u.prompt_tokens or 0
    slot["output_tokens"] += u.completion_tokens or 0


def usage_summary() -> dict:
    total = 0.0
    for model, s in USAGE.items():
        pin, pout = PRICES.get(model, (3.0, 15.0))
        s["est_usd"] = round(s["input_tokens"] / 1e6 * pin + s["output_tokens"] / 1e6 * pout, 4)
        total += s["est_usd"]
    return {"models": USAGE, "est_total_usd": round(total, 4)}


def _create(**kw):
    resp = client().chat.completions.create(**kw)
    _record_usage(kw["model"], resp)
    return resp


def complete(system: str, user: str, model: str = MODEL, max_tokens: int = 4000) -> str:
    resp = _create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return resp.choices[0].message.content or ""


def complete_json(system: str, user: str, model: str = MODEL, max_tokens: int = 4000) -> Any:
    return parse_json(complete(system + "\nReply with JSON only, no prose.", user, model, max_tokens))


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    fn: Callable[..., Any]

    def spec(self) -> dict:
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }


def run_tool_agent(
    name: str,
    system: str,
    user: str,
    tools: list[Tool],
    max_steps: int = 12,
    model: str = MODEL,
    log: Callable[[str], None] = print,
) -> str:
    """Run a tool-using agent until it answers in plain text (expected JSON)."""

    @neatlogs.span(kind="AGENT", name=name)
    def _run() -> str:
        by_name = {t.name: t for t in tools}
        seen_calls: set[str] = set()
        messages: list[dict] = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        for step in range(max_steps):
            resp = _create(
                model=model,
                max_tokens=6000,
                messages=messages,
                tools=[t.spec() for t in tools],
            )
            msg = resp.choices[0].message
            if not msg.tool_calls:
                return msg.content or ""
            messages.append(msg.model_dump(exclude_none=True))
            _prune_old_tool_results(messages)
            for call in msg.tool_calls:
                tool = by_name[call.function.name]
                args = json.loads(call.function.arguments or "{}")
                log(f"  [{name}] {tool.name}({', '.join(f'{k}={str(v)[:60]!r}' for k, v in args.items())})")
                sig = f"{tool.name}:{json.dumps(args, sort_keys=True)}"
                if sig in seen_calls:  # the model re-requested an identical call: do not spend tokens again
                    result = "You already made this exact call earlier in this run. Reuse that result."
                else:
                    seen_calls.add(sig)
                    result = _call_tool(tool, args)
                messages.append({"role": "tool", "tool_call_id": call.id, "content": result})
        # Out of steps: force a final answer without tools.
        messages.append({"role": "user", "content": "Stop using tools and give your final JSON answer now."})
        resp = _create(model=model, max_tokens=6000, messages=messages)
        return resp.choices[0].message.content or ""

    return _run()


KEEP_FULL_RESULTS = 3
PRUNED_CHARS = 600


def _prune_old_tool_results(messages: list[dict]) -> None:
    """Shrink all but the newest tool results in place.

    Each step of a tool loop re-sends the whole history, so ten full web pages cost ten times
    their size per step. The model has already extracted what it needed from older pages; keep a
    short head of each so it can still recognise them, and the full text only for the latest few.
    """
    idx = [i for i, m in enumerate(messages) if m.get("role") == "tool"]
    for i in idx[:-KEEP_FULL_RESULTS]:
        content = messages[i]["content"]
        if len(content) > PRUNED_CHARS and not content.endswith("[truncated]"):
            messages[i]["content"] = content[:PRUNED_CHARS] + "\n...[truncated]"


def _call_tool(tool: Tool, args: dict) -> str:
    with neatlogs.trace(tool.name, kind="TOOL") as span:
        span.set_attribute("tool.args", json.dumps(args)[:2000])
        try:
            out = tool.fn(**args)
        except Exception as e:  # the model should see failures and adapt
            out = {"error": f"{type(e).__name__}: {e}"}
        text = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False)
        span.set_attribute("tool.result_chars", len(text))
        return text[:20000]

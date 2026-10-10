"""Tests for the parts of hioffer that must behave the same every time, with no model involved."""
import json
from pathlib import Path

import pytest

from hioffer.agents.decider import compare_offers
from hioffer.agents.planner import merge_todos
from hioffer.agents.verifier import TAG
from hioffer.llm import _prune_old_tool_results, parse_json
from hioffer.programs import add_program, load_programs


def test_parse_json_tolerates_fences_and_prose():
    assert parse_json('Here you go:\n```json\n{"a": 1}\n```', repair=False) == {"a": 1}
    assert parse_json('Sure. {"b": [1, 2]} trailing', repair=False)["b"] == [1, 2]


def test_parse_json_raises_without_repair_on_garbage():
    with pytest.raises(Exception):
        parse_json('{"quote": "he said "hi""}', repair=False)


def test_prune_keeps_newest_three_tool_results_full():
    msgs = [{"role": "system", "content": "s"}]
    for i in range(5):
        msgs.append({"role": "tool", "tool_call_id": str(i), "content": "x" * 2000})
    _prune_old_tool_results(msgs)
    tool = [m for m in msgs if m["role"] == "tool"]
    assert all(t["content"].endswith("[truncated]") for t in tool[:2])
    assert all(len(t["content"]) == 2000 for t in tool[2:])


def test_citation_tag_regex_accepts_three_kinds():
    text = "Fact [lib:cv]. Paper [paper:W123]. Advisor [advisor:Yulia Tsvetkov]."
    assert TAG.findall(text) == [("lib", "cv"), ("paper", "W123"), ("advisor", "Yulia Tsvetkov")]


def test_compare_offers_ranks_by_visible_weights():
    offers = [
        {"id": "a", "program": "P1", "advisor": "Dr A", "stipend_usd": 40000, "years_guaranteed": 5},
        {"id": "b", "program": "P2", "advisor": None, "stipend_usd": 40000, "years_guaranteed": 1},
    ]
    advisors = {"P1": {"advisors": [{"name": "Dr A", "fit_score": 5}]}, "P2": {"advisors": [{"name": "Dr B", "fit_score": 5}]}}
    signals = [{"program": "P2", "kind": "reply_negative"}]
    out = compare_offers(offers, advisors, signals)
    assert [r["id"] for r in out["ranked"]] == ["a", "b"]
    assert out["ranked"][0]["subscores"] == {"advisor_fit": 1.0, "funding": 1.0, "signals": 0.5, "guarantee": 1.0}
    assert out["ranked"][1]["subscores"]["signals"] == 0.2
    assert abs(sum(out["weights"].values()) - 1.0) < 1e-9


def test_merge_todos_keeps_done_flags_and_user_items():
    existing = [{"id": "p-1", "task": "old", "done": True}, {"id": "t1", "task": "mine", "done": False}]
    new = [{"id": "p-1", "task": "regenerated", "done": False}, {"id": "p-2", "task": "new", "done": False}]
    merged = merge_todos(existing, new)
    by_id = {t["id"]: t for t in merged}
    assert by_id["p-1"]["done"] is True and by_id["p-1"]["task"] == "regenerated"
    assert "t1" in by_id and "p-2" in by_id


def test_programs_extra_merge(tmp_path: Path):
    app = tmp_path / "applicant"
    app.mkdir()
    (app / "programs.yaml").write_text("programs:\n  - name: A\n    institution: X\n")
    ws = tmp_path / "ws"
    add_program(ws, {"name": "B", "institution": "Y"})
    add_program(ws, {"name": "A", "institution": "dup"})  # seed wins on name clash
    progs = load_programs(app, ws)
    assert [p["name"] for p in progs] == ["A", "B"]
    assert progs[0]["institution"] == "X"
    assert json.loads((ws / "programs_extra.json").read_text())[0]["name"] == "B"

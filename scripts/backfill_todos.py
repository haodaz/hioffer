"""Generate the timeline for programs finished before the planner existed (one cheap call per program).

    PYTHONPATH=. uv run python scripts/backfill_todos.py examples/applicants/priya
"""
import json
import sys
from pathlib import Path

import yaml

from hioffer import config

config.init_tracing(tags=["backfill-todos"])
from hioffer.agents.planner import merge_todos, plan_todos  # noqa: E402
from hioffer.orchestrator import slug  # noqa: E402
from hioffer.state import Workspace  # noqa: E402

applicant_dir = Path(sys.argv[1])
ws = Workspace(Path("workspace") / applicant_dir.name)
programs = yaml.safe_load((applicant_dir / "programs.yaml").read_text())["programs"]
try:
    for p in programs:
        k = slug(p["name"])
        req, adv = ws.load(f"{k}/requirements"), ws.load(f"{k}/advisors_connected") or ws.load(f"{k}/advisors")
        if not (req and adv):
            continue
        versions = sorted((ws.root / k).glob("materials_v*.json"))
        mat = json.loads(versions[-1].read_text()) if versions else None
        new = plan_todos(p["name"], req, adv, mat)
        ws.save("todos", merge_todos(ws.load("todos", []), new))
        for t in new:
            print(f"{p['short']:8} {t['due'] or '----------'}  {t['task'][:90]}")
finally:
    config.shutdown_tracing()

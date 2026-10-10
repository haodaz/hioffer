"""Add identity anchoring to advisors files produced before the identity step existed. No model calls.

    uv run python scripts/backfill_identity.py examples/applicants/priya
"""
import json
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv()

from hioffer.agents.identity import anchor_identity  # noqa: E402
from hioffer.orchestrator import slug  # noqa: E402

applicant_dir = Path(sys.argv[1])
ws = Path("workspace") / applicant_dir.name
programs = yaml.safe_load((applicant_dir / "programs.yaml").read_text())["programs"]
for p in programs:
    for fname in ("advisors.json", "advisors_connected.json"):
        f = ws / slug(p["name"]) / fname
        if not f.exists():
            continue
        data = json.loads(f.read_text())
        for adv in data.get("advisors", []):
            adv["identity"] = anchor_identity(adv, p["institution"], p["faculty_url"])
            print(f"{p['short']:8} {adv['name']:24} {adv['identity']['confidence']:7} {adv['identity']['reasons']}")
        f.write_text(json.dumps(data, indent=2, ensure_ascii=False))

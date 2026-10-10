"""The applicant's program list: the seed `programs.yaml` plus programs added during use."""
import json
from pathlib import Path

import yaml


def load_programs(applicant_dir: Path, workspace_root: Path) -> list[dict]:
    seed = yaml.safe_load((Path(applicant_dir) / "programs.yaml").read_text())["programs"]
    extra_path = Path(workspace_root) / "programs_extra.json"
    extra = json.loads(extra_path.read_text()) if extra_path.exists() else []
    names = {p["name"] for p in seed}
    return seed + [p for p in extra if p["name"] not in names]


def add_program(workspace_root: Path, program: dict) -> list[dict]:
    extra_path = Path(workspace_root) / "programs_extra.json"
    extra = json.loads(extra_path.read_text()) if extra_path.exists() else []
    extra = [p for p in extra if p["name"] != program["name"]] + [program]
    extra_path.parent.mkdir(parents=True, exist_ok=True)
    extra_path.write_text(json.dumps(extra, indent=2, ensure_ascii=False))
    return extra

"""Workspace: one folder per applicant, one JSON file per artifact.

Each orchestration step writes its result to disk when it finishes. A re-run
skips steps whose result file already exists, which is how a crashed run resumes.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class Workspace:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    def has(self, key: str) -> bool:
        return self.path(key).exists()

    def load(self, key: str, default: Any = None) -> Any:
        p = self.path(key)
        if not p.exists():
            return default
        return json.loads(p.read_text())

    def save(self, key: str, data: Any) -> None:
        p = self.path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        self._log(f"saved {key}")

    def _log(self, line: str) -> None:
        ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with (self.root / "run.log").open("a") as f:
            f.write(f"{ts} {line}\n")

"""Applicants and invite codes.

Deliberately light for the demo: an applicant is a folder of materials plus a workspace; an invite code
is the only credential. Seed applicants live in `examples/applicants/`, ones created through the app in
`data/applicants/`. Codes are stored in `data/invites.json` (`{code: applicant_id}`); the two demo codes
are fixed so anyone with the README can try the demo.
"""
import json
import re
import secrets
from pathlib import Path

SEED_DIR = Path("examples/applicants")
DATA_DIR = Path("data/applicants")
INVITES = Path("data/invites.json")
DEMO_CODES = {"PRIYA-DEMO": "priya", "ARJUN-DEMO": "arjun"}


def applicant_dir(applicant: str) -> Path | None:
    for base in (DATA_DIR, SEED_DIR):
        if (base / applicant).is_dir():
            return base / applicant
    return None


def invites() -> dict[str, str]:
    saved = json.loads(INVITES.read_text()) if INVITES.exists() else {}
    return {**DEMO_CODES, **saved}


def resolve(code: str) -> str | None:
    """Applicant id for an invite code, or None."""
    return invites().get((code or "").strip().upper())


def profile_name(applicant: str) -> str:
    d = applicant_dir(applicant)
    if not d:
        return applicant
    for f in ("profile.md", "cv.md"):
        p = d / f
        if p.exists():
            m = re.search(r"Name:\s*(.+)", p.read_text(), re.I)
            if m:
                return m.group(1).strip()
    return applicant.title()


def create_applicant(name: str, files: list[dict], programs: list[dict], code: str | None = None) -> dict:
    """Create a folder of materials + programs.yaml and register an invite code. No model calls."""
    import yaml

    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:32] or "applicant"
    base = slug
    i = 2
    while applicant_dir(slug):
        slug = f"{base}-{i}"
        i += 1
    d = DATA_DIR / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "profile.md").write_text(f"# Profile\n\n- Name: {name}\n")
    for f in files:
        fname = re.sub(r"[^A-Za-z0-9._-]+", "-", f["name"])[:64]
        if not fname.lower().endswith((".md", ".txt", ".pdf")):
            fname += ".md"
        (d / fname).write_text(f["content"])
    (d / "programs.yaml").write_text(yaml.safe_dump({"programs": programs}, sort_keys=False, allow_unicode=True))
    code = (code or f"HI-{secrets.token_hex(3).upper()}").upper()
    saved = json.loads(INVITES.read_text()) if INVITES.exists() else {}
    saved[code] = slug
    INVITES.parent.mkdir(parents=True, exist_ok=True)
    INVITES.write_text(json.dumps(saved, indent=2))
    return {"applicant": slug, "name": name, "code": code}

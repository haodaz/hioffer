"""Command line entry point.

    uv run python -m hioffer.cli run examples/applicants/priya --program Washington
"""
import argparse
import json
from pathlib import Path

from . import config  # noqa: F401  (initialises env; tracing is started below)


def main() -> None:
    ap = argparse.ArgumentParser(prog="hioffer")
    sub = ap.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run", help="prepare applications for an applicant folder")
    run.add_argument("applicant_dir")
    run.add_argument("--workspace", default="workspace")
    run.add_argument("--program", action="append", help="only programs whose name contains this (repeatable)")
    run.add_argument("--tag", action="append", default=[], help="neatlogs tag for this run (repeatable)")
    args = ap.parse_args()

    config.init_tracing(tags=["cli", *args.tag])
    from .orchestrator import prepare_applications

    try:
        summary = prepare_applications(Path(args.applicant_dir), Path(args.workspace), args.program)
        print("\n" + json.dumps(summary, indent=2, ensure_ascii=False))
    finally:
        config.shutdown_tracing()


if __name__ == "__main__":
    main()

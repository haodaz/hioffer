"""Environment, tracing and model client setup.

Import this module first: neatlogs.init() must run before `openai` is imported
so that auto-instrumentation can patch the client.
"""
import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

import neatlogs  # noqa: E402

MODEL = os.environ.get("HIOFFER_MODEL", "claude-sonnet-4.6")
CHEAP_MODEL = os.environ.get("HIOFFER_CHEAP_MODEL", "claude-haiku")
# Research tool loops (reading pages, OpenAlex lookups) can run on a cheaper model than writing/verifying.
RESEARCH_MODEL = os.environ.get("HIOFFER_RESEARCH_MODEL", MODEL)

_initialised = False


def init_tracing(tags: list[str] | None = None) -> None:
    global _initialised
    if _initialised:
        return
    neatlogs.init(
        api_key=os.environ["NEATLOGS_API_KEY"],
        workflow_name="hioffer",
        instrumentations=["openai"],
        tags=tags or [],
        capture_logs=True,
    )
    _initialised = True


def shutdown_tracing() -> None:
    if _initialised:
        neatlogs.flush()
        neatlogs.shutdown()


@lru_cache(maxsize=1)
def client():
    from openai import OpenAI

    return OpenAI(
        api_key=os.environ["LITELLM_API_KEY"],
        base_url=os.environ["LITELLM_BASE_URL"],
    )

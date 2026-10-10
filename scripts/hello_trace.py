"""Send one minimal trace to neatlogs: a WORKFLOW span wrapping a single LLM call.

Run:  uv run python scripts/hello_trace.py
"""
import os

from dotenv import load_dotenv

load_dotenv()

import neatlogs  # noqa: E402

# init() must run before the openai import so auto-instrumentation can patch it.
neatlogs.init(
    api_key=os.environ["NEATLOGS_API_KEY"],
    workflow_name="hioffer",
    instrumentations=["openai"],
    tags=["hello-trace"],
)

from openai import OpenAI  # noqa: E402


@neatlogs.span(kind="WORKFLOW")
def hello() -> str:
    client = OpenAI(
        api_key=os.environ["LITELLM_API_KEY"],
        base_url=os.environ["LITELLM_BASE_URL"],
    )
    resp = client.chat.completions.create(
        model=os.environ["HIOFFER_MODEL"],
        messages=[{"role": "user", "content": "Reply with exactly: hioffer is alive"}],
        max_tokens=20,
    )
    return resp.choices[0].message.content


if __name__ == "__main__":
    try:
        print(hello())
    finally:
        neatlogs.flush()
        neatlogs.shutdown()

# hioffer

A PhD-application agent, built in public for neatHack (Oct 10-12, 2026).

**Live demo:** https://hioffer-one.vercel.app (frontend) · API: https://hioffer-production.up.railway.app · Demo applicant is fictional.

Give it one goal, e.g. *"prepare my applications to these 3 CS PhD programs"*, and it:

1. Builds a **material library** from the applicant's files (CV, SOP, research statement, writing samples, recommenders).
2. Researches each program's **official requirements** (deadlines, word limits, documents, letters, fee), keeping the source URL and quoted text for every fact.
3. Finds **faculty whose recent work matches** the applicant's interests (department pages + OpenAlex), keeps only papers OpenAlex actually returned, flags whether they appear to take students, and adds light **co-author / alumni links** to the applicant's circle.
4. **Tailors materials** per program (fit paragraph per advisor, SOP variant within limits) and drafts outreach emails, every sentence tagged with its source.
5. **Verifies its own output** (word limits, citations resolve, claims supported, requirement coverage), revises what the writer can fix, turns the rest into to-dos, and checkpoints every step so a crashed run resumes.

The human sends emails, pays fees and submits. The agent never does.

## Architecture

```
web/ (Next.js)  ──SSE──▶  hioffer/server.py (FastAPI)
                              │  chat.py: root agent, talks + emits cards
                              ▼
                 orchestrator.py  (WORKFLOW span, JSON checkpoints in workspace/)
     librarian → program_researcher → advisor_scout → connector → writer → verifier
       AGENT         AGENT + TOOLs        AGENT + TOOLs    AGENT    AGENT   GUARDRAIL
                     fetch_page       fetch_page, find_author, recent_works (OpenAlex)
```

Every run is one neatlogs trace: the workflow span, one AGENT span per sub-agent, one TOOL span per
tool call, plus a CHAIN span when malformed JSON has to be repaired.

## Hackathon tooling

- **neatlogs** traces every agent run (model/tool calls, tokens, cost). Runs are tagged (`run1` … `run5`,
  `after-fix`, `pruned`) so before/after comparisons are one filter away.
- **Entire** records the coding-agent sessions behind each commit (`entire checkpoint list`).
- **cfo.ai** holds the business plan (pricing, costs, revenue, runway), fed by the per-run cost in neatlogs: https://cfo.ai/s/A_qiW6hIGmm-3fDR

See [hackathon.md](hackathon.md) for the dated build log, the failures found in traces and their fixes.

## Setup

Requires Python 3.10+ (we use [uv](https://docs.astral.sh/uv/)) and Node 20+.

```bash
cp .env.example .env          # fill in LITELLM_*, NEATLOGS_API_KEY, OPENALEX_API_KEY
uv sync                       # Python deps into .venv
cd web && npm install && cd ..
```

## Run

Command line, full pipeline for the demo applicant (fictional; see `examples/applicants/priya/README.md`):

```bash
uv run python -m hioffer.cli run examples/applicants/priya --program Washington --tag my-run
```

Outputs land in `workspace/priya/<program>/` (`requirements.json`, `advisors_connected.json`,
`materials_vN.json`, `verification_vN.json`, `final.json`). Re-running skips finished steps.

Web app:

```bash
uv run uvicorn hioffer.server:app --port 8000 --reload
cd web && npm run dev          # then open http://localhost:3000
```

## Tests

```bash
NEATLOGS_API_KEY=x uv run pytest -q
```

Covers the deterministic parts: JSON parsing, tool-result pruning, citation tags, offer scoring, to-do
merging and program-list merging. The model-driven stages are checked by the verifier at runtime and by
the neatlogs traces.

## Evidence

- `evidence/neatlogs/` — trace list, trace tree, detections, the run-1 error inside the trace.
- `evidence/entire/` — `entire checkpoint list`, `checkpoint explain`, `checkpoint tokens`, `entire why`.
- `evidence/cfo-ai/` — the financial model pages; public link above.
- `evidence/2026-10-10-run*/` — raw agent outputs before and after each fix.

## Limitations

- Faculty discovery depends on department pages being fetchable and on OpenAlex author disambiguation;
  faculty whose record cannot be matched are listed under "skipped" rather than guessed.
- Requirements come only from pages the researcher could fetch; anything not found is listed as not found.
- One applicant per workspace; no accounts.

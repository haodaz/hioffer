# hackathon.md — hioffer

## Project

- **Name:** hioffer
- **One sentence:** An agent that prepares a PhD applicant's applications end to end: material library, per-program requirements with sources, advisor matching with cited papers, tailored documents and outreach drafts, and self-verification.
- **Problem:** Most PhD applicants apply on their own. Agencies are expensive and cannot judge research fit. The hard parts are finding the right advisors and handling many similar-but-slightly-different program requirements.
- **Boundary:** The human sends emails, pays fees and submits. The agent never does.

## Team

- Zhuang H. (solo), building with Claude Code.

## Stack

- Python 3.10+ agent.
- Models: the hackathon LiteLLM proxy (Claude / Nova).
- neatlogs Python SDK for tracing every run.
- Entire CLI for session checkpoints linked to commits.
- cfo.ai for the business plan.
- Data sources: official program pages, department faculty pages, OpenAlex and Semantic Scholar APIs (Crustdata optional).

## Build log

### 2026-10-10

- **Planned:** repo bootstrap, Entire enabled before the first code commit, first neatlogs trace, then the end-to-end agent loop.
- **Done:** installed Entire CLI 0.11.4, `git init`, `entire enable --agent claude-code` (9 Claude Code hooks installed, checkpoints stored as git refs). Created `.gitignore`, `.env.example`, README, this file.
- **Done:** Python 3.12 venv via uv (`neatlogs` 1.4.26, `openai`), `scripts/hello_trace.py` sent the first trace (WORKFLOW span + one auto-instrumented chat call to `claude-sonnet-4.6` on the hackathon LiteLLM proxy). Model replied "hioffer is alive".
- **Failures / notes:**
  - Entire could not import session history before the first commit ("cannot import sessions without a valid anchor commit"), expected for an empty repo; the first commit is the config files. Hooks logged turn-start/turn-end from the first session.
  - `.env` was first filled with the docs page URL as `LITELLM_BASE_URL`; the real endpoint is `https://litellm.vision.aivar.app/v1` (from neatlogs.com/hackathon/models). Fixed before the first run.
- **Evidence:** first neatlogs trace tagged `hello-trace` in workflow `hioffer` (link to be added).

#### Agent core, first end-to-end runs (same day)

- **Built:** `hioffer/` package: librarian, program_researcher (tool agent over `fetch_page`), advisor_scout
  (tool agent over `fetch_page` + OpenAlex `find_author`/`recent_works`), writer, verifier, orchestrator with
  per-step JSON checkpoints in `workspace/<applicant>/`. CLI: `uv run python -m hioffer.cli run examples/applicants/priya`.
  Trace tree in neatlogs: WORKFLOW `prepare_applications` → AGENT spans per sub-agent → TOOL spans per call.
- **Run 1 (tag `run1`) failed:** `program_researcher` fetched 11 pages, then its final JSON did not parse
  (unescaped quotes inside a `quote` field; `JSONDecodeError ... char 3102`). The trace also showed the same
  page fetched three times. The library step had already checkpointed, so run 2 resumed without re-reading files.
- **Fix 1:** `parse_json` now asks the cheap model to repair malformed JSON once (own CHAIN span `repair_json`);
  identical tool calls within one agent run are short-circuited with "you already made this call".
- **Run 2 (tag `run2`) finished but failed verification 3 times on the same issue.** Reading the outputs:
  1. The verifier flagged "program requires research_statement" although the researcher had written
     "No separate standalone research statement required" — a substring check, and an issue the writer cannot
     fix anyway, so two revisions were wasted.
  2. Worse: `advisor_scout` listed real-looking papers with invented ids (`tsvetkov-magnet-2024`) for papers it
     saw on lab pages rather than in OpenAlex. The citation check only verified ids against the scout's own
     output, so the fabricated ids passed.
  Evidence: `evidence/2026-10-10-run2-before-fix/`.
- **Fix 2:** researcher facts carry `required: yes|no|optional|unknown`; coverage uses that field and produces
  applicant to-dos instead of writer feedback. `advisor_scout` records every work OpenAlex actually returned and
  drops any cited paper whose id was not among them (moved to `unverified_mentions`), so the writer can only cite
  verified papers.
- **Run 3 (tags `run3`, `after-fix`):** result below.

## Demo

- Video: TBD
- Reproduce: TBD

## Known limitations and next steps

- Nothing built yet beyond the scaffold.

## Submission checklist

- [ ] Public repo with hackathon-dated commits
- [ ] neatlogs traces (before/after a fix, failure recovery)
- [ ] Entire checkpoints / entire-graph output
- [ ] cfo.ai business plan
- [ ] Demo video (≤3 min) covering neatlogs, Entire, cfo.ai
- [ ] Public posts on X with #neatHack
- [ ] Quote post of the official neatlogs post during the submission window

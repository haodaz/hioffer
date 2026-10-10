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
- **Failures / notes:** Entire could not import session history before the first commit ("cannot import sessions without a valid anchor commit"), which is expected for an empty repo; the first commit is the config files.
- **Evidence:** to be added (Entire checkpoint ids, neatlogs trace links).

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

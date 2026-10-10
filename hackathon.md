# hackathon.md — hioffer

## Project

- **Name:** hioffer
- **One sentence:** An agent that prepares a PhD applicant's applications end to end: material library, per-program requirements with sources, advisor matching with cited papers, tailored documents and outreach drafts, and self-verification.
- **Problem:** Most PhD applicants apply on their own. Agencies are expensive and cannot judge research fit. The hard parts are finding the right advisors and handling many similar-but-slightly-different program requirements.
- **Boundary:** The human sends emails, pays fees and submits. The agent never does.

## Team

- Zhuang H. (@vibedding on X), solo, building with Claude Code.

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
- **Run 3 (tags `run3`, `after-fix`):** verification now *caught* real fabrications instead of missing them
  (11 → 6 → 8 writer issues over three drafts): invented project names, papers attributed to the wrong
  professor, applicant files cited for claims about professors. Root causes were mine: the OpenAlex author
  filter dropped faculty whose last-known institution is a lab (3 of 5 advisors ended with zero verified
  papers, so the writer had nothing to cite), the writer had no citation type for advisor facts, and the
  auditor could not see paper authors/venues. Evidence: `evidence/2026-10-10-run3-before-fix/`.
- **Fix 3:** soft institution match; advisors without verified papers are demoted to `skipped`; new
  `[advisor:<name>]` citation type; auditor sees authors/venue/year; per-run token/cost estimate.
- **Run 4 (tags `run4`, `after-fix-2`), three programs:**
  - UW: passed on the first draft, no fabrications (`evidence/2026-10-10-run4/uw-materials-passed.json`).
  - UMD: 3 verified advisors; failed on two new bugs of mine (author lists truncated to 6 names made the
    auditor doubt authorship; a one-digit paper-id typo was treated as fabrication). Fixed: full author
    lists + a note to the auditor; near-miss ids are repaired in code and logged.
  - Cornell: **OpenAlex's free daily budget ran out mid-run** (HTTP 429, `retry-after` ≈ 11 h), the scout
    returned zero advisors, and the package still "passed" because there was nothing to check. Fixed: OpenAlex
    responses cached on disk, optional `OPENALEX_API_KEY`, budget-exhausted 429 fails fast; a program with no
    verified advisors is now reported as `blocked`, not complete.
  - **Cost:** run 4 used ~1.95M input tokens / 45k output tokens over 71 Sonnet calls (≈ $6.5 at list
    price). The tool loops re-send every fetched page on every step. Fix: older tool results are pruned to
    600 chars (newest 3 kept), page text capped at 9k chars. Before/after cost comparison is the next run.
- **Step 2, chat product (same day):** FastAPI backend (`hioffer/server.py`) streams Server-Sent Events
  (`tool_start`, `tool_log`, `tool_end`, `card`, `delta`, `final`); the root chat agent (`hioffer/chat.py`) talks
  and "speaks in cards" (programs, requirements with sources, advisor, materials, library, todos, confirm).
  Next.js 16 + Tailwind frontend in `web/`: landing page with the cover image, `/app` with chat on the left and
  Programs / Advisors / Materials / Timeline panels on the right, English/Chinese toggle. Expensive actions
  (`run_prepare`) show a confirm card first.
  - Bug found in the UI: "UW" matched nothing because program lookup was a plain substring test, and the model
    then invented "two possible candidates". Fixed with `short` aliases in `programs.yaml`, alias/institution
    matching, and an error message that tells the model to ask instead of guessing.
- **Run 5 (tags `run5`, `pruned`), Cornell only, after the context pruning and with an OpenAlex key:**
  3 verified advisors, draft v1 passed (v0 had two real claim issues the writer then fixed). Cost evidence,
  per Sonnet call (the honest comparison, since run 4 covered three programs and run 5 reused cached
  requirements): run 4 averaged **27.4k input tokens per call** (1.95M / 71); run 5 averaged **13.6k**
  (408k / 30), about half, with the same tool-loop behaviour. Run 5 total ≈ $1.43 est. for one program's
  advisor → connector → draft → verify stages. Evidence: `evidence/2026-10-10-run5-pruned/`.
  Still open: the scout skipped two Cornell faculty because `find_author` errored, and three advisors have
  no co-author/alumni link to the (fictional) applicant's circle, which is expected for invented people.
- **Identity anchoring (Oct 10, later):** each kept advisor now carries `identity`: faculty directory /
  profile page + OpenAlex affiliation history. Same name alone never counts; no affiliation overlap → medium,
  no affiliation data → low (writer may then cite only papers). Backfilled on the three programs: all 8
  advisors "high" (e.g. Tsvetkov: University of Washington 2021–2026 on OpenAlex). Also fixed a crash on
  OpenAlex records with `null` institutions that had made the scout skip Lillian Lee at Cornell.
- **Planner / timeline:** after a program package is verified, a planner turns requirements + advisors into
  dated to-dos for the human (email each advisor with a ready draft; ask and remind recommenders; send test
  scores; upload transcripts; pay the fee and submit). Deadline strings are normalised to ISO dates with one
  Haiku call; everything else is arithmetic. 23 to-dos across the three programs, shown in the Timeline panel
  with checkboxes. The confirm card for `run_prepare` was verified in the UI (no run triggered).
- **Signals and Offers (modules 5 and 6):** signals (email sent, reply ±, interview, waitlist, admit, reject,
  funding) can be logged from the panel or by telling the agent ("Hajishirzi replied, positive"); offers are
  compared by a deterministic, visible-weight scorer (advisor fit 0.35, funding 0.30, signals 0.20, guarantee
  0.15) that the agent only explains, never overrides. Demo data for both is a clearly labelled fictional
  sample scenario. The agent's system prompt now carries the program/advisor roster so it resolves
  "Hajishirzi" → UW instead of asking. hioffer's face is the robot from the cover (chat avatar, header).
- **Find programs (module 1, recommendation):** `recommend_programs` turns the applicant's interests into
  five short OpenAlex search phrases, counts 2024+ papers per US university on those topics (hard evidence of
  research activity), then one model call positions the applicant and tiers 8-10 institutions as
  reach / match / safety with reasons citing the counts; it is told that selectivity is general knowledge and
  must never state admit rates, deadlines or fees. First attempt used 3-6-word phrases and two of three
  returned 0-1 institutions (OpenAlex ANDs every word); 2-3-word standard terms fixed it (CMU 197 papers,
  Stanford 116, JHU 87). Each tier item has an "Add" button → `add_program` → `workspace/programs_extra.json`,
  merged with `programs.yaml`; programs without URLs are reported as blocked until the applicant supplies them.
- **Interaction model rework (Oct 10, afternoon):** the always-on right panel contradicted the "agent leads"
  idea. Now: left sidebar = the human-managed pages (Programs, Advisors, Materials, Timeline, Signals, Offers)
  on top, conversation history below; the chat is the full-width main stage; when the agent answers with a
  card, a preview pane slides in on the right (like opening a document) and the chat keeps a small chip to
  reopen it; each management page has an "Ask hioffer about this page" box that jumps back into the chat with
  the page as context. Conversations persist in the browser. Found and fixed during the rework: a seeded
  question created the conversation twice; the avatar was stretched by flex; Next.js 16 requires `useParams`
  inside `<Suspense>` for prerendering.
- **neatlogs evidence captured (`evidence/neatlogs/`):** 01 traces list (32 traces on Oct 10, tagged per run);
  02 run 5 trace tree (WORKFLOW → advisor_scout AGENT → LLM spans with token counts → TOOL spans with
  latency, 106 steps, 2m43s); 03 the three detections neatlogs configured (Expensive LLM Call > $1, Slow LLM
  Response > 30 s, Execution Failed on any ERROR span); 04 Execution Failed flagged spans; 05 run 1's
  `prepare_applications` span with the error text `Expecting ',' delimiter: line 31 column 156 (char 3102)`.
  **The detection found something I had missed:** three `connector` spans failed (two during a test at 08:38
  on the OpenAlex 429, one inside run 5 at 09:15 with `'NoneType' object is not iterable`), so Cornell's
  package had silently skipped the relationship step. Re-running the connector after the null-field fix hit a
  second null case (authors without an OpenAlex id); fixed too. All three programs now have a clean
  connector pass; the fictional applicant's circle has no OpenAlex presence, so the honest result is
  "no co-author or alumni link found".
- **cfo.ai business plan (Oct 10, late morning):** prompt in `business/cfo-ai-inputs.md`, results in
  `business/cfo-ai-results.md`, screenshots in `evidence/cfo-ai/`. Ari built an Assumptions page, a monthly
  P&L + cash-flow page for 2027–2029, a $150k pre-seed scenario and a cash simulator. Headline numbers: max
  COGS for a 60% margin at $49 is **$19.60** (today's $22 is above it; the planned $9 is well under);
  445 paying users/month (early COGS) or 300 (later) cover two $6k founder salaries. **The non-obvious
  finding:** with 70% of sales in Oct–Dec, the funded scenario runs out of cash in **August of Year 2**
  ($17,650 short) right before the peak, while bootstrapping needs only a ~$900 bridge. Decision: bootstrap
  the first cycle, pre-sell passes in Aug–Sep, and treat cheaper model routing as the margin lever.
- **Cheaper-model routing, negative result (Oct 10, noon):** added `HIOFFER_RESEARCH_MODEL` so the
  tool-loop agents can run on a cheaper model, and re-ran the Cornell requirements research on
  `claude-haiku` (tags `haiku-vs-sonnet`, `research-haiku`). Haiku made 12 calls ($0.20 est.), re-requested
  the same Graduate School page eleven times despite the "you already made this call" reply, and returned
  **0 facts**; Sonnet on the same task returned 12 sourced facts from 22 pages. Evidence:
  `evidence/2026-10-10-haiku-vs-sonnet/`. Consequence: the "$22 → $9 COGS" assumption in the cfo.ai model is
  **not yet earned**; the proven lever so far is context pruning (per-call input tokens halved). Next
  options: a stricter scaffold for small models (explicit page queue, no free navigation) or Haiku only for
  extraction after Sonnet picks the pages. Routing stays on Sonnet for now.
- **Added:** connector step (co-author and alumni links between the applicant's circle and each advisor,
  each edge with an OpenAlex paper or affiliation as evidence). Scope deliberately small.

## Demo

- Live demo: https://hioffer-one.vercel.app/ (frontend on Vercel) → `/app` talks to the API at https://hioffer-production.up.railway.app (Docker on Railway, demo workspace pre-loaded)
- Repo: https://github.com/haodaz/hioffer
- Video: TBD
- Reproduce: see README (Setup / Run)

## Known limitations and next steps

- Nothing built yet beyond the scaffold.

## Submission checklist

- [ ] Public repo with hackathon-dated commits
- [x] neatlogs traces (before/after a fix, failure recovery) — `evidence/neatlogs/`, build log above
- [ ] Entire checkpoints / entire-graph output
- [x] cfo.ai business plan — public model: https://cfo.ai/s/A_qiW6hIGmm-3fDR · `business/cfo-ai-results.md` · `evidence/cfo-ai/`
- [ ] Demo video (≤3 min) covering neatlogs, Entire, cfo.ai
- [x] Public posts on X with #neatHack — day 1: https://x.com/vibedding/status/2108912402540458190
- [ ] Quote post of the official neatlogs post during the submission window

# hackathon.md — hioffer

## Project

- **Name:** hioffer
- **One sentence:** An agent that prepares a PhD applicant's applications end to end: finds programs, researches
  each program's official requirements with sources, matches advisors on OpenAlex-verified papers, tailors a
  statement and outreach drafts with every claim traced, verifies its own output, and keeps the human's timeline,
  signals and offer comparison.
- **Problem:** Most PhD applicants apply on their own. Agencies are expensive and cannot judge research fit. The
  hard parts are finding the right advisors and handling many similar-but-slightly-different program requirements.
- **Boundary:** The human sends emails, pays fees and submits. The agent never does.
- **Live demo:** https://hioffer-one.vercel.app (frontend, Vercel) → `/app` uses the API at
  https://hioffer-production.up.railway.app (Docker on Railway, demo workspace pre-loaded).
- **Repo:** https://github.com/haodaz/hioffer

## Team

- Zhuang H. (@vibedding on X), solo, building with Claude Code.

## Stack

- Python 3.12 agent (`hioffer/`): root chat agent + six sub-agents (librarian, program_researcher, advisor_scout,
  connector, writer, verifier) + planner, recommender, decider; FastAPI server streaming SSE.
- Models: the hackathon LiteLLM proxy; `claude-sonnet-4.6` for everything that matters, `claude-haiku` for JSON
  repair and date normalisation.
- Frontend: Next.js 16 + Tailwind (`web/`), English/Chinese.
- **neatlogs** Python SDK: one trace per run, WORKFLOW → AGENT → TOOL spans, runs tagged `run1` … `run5`.
- **Entire** CLI: Claude Code sessions checkpointed per commit, refs pushed with the repo.
- **cfo.ai**: the business plan, fed by measured per-run cost.
- Data: official program pages, department faculty pages, OpenAlex (with a personal key).

## Build log

### 2026-10-10 — bootstrap (morning)

- Installed Entire CLI 0.11.4, `git init`, `entire enable --agent claude-code` before any code. Entire could not
  import history before the first commit ("cannot import sessions without a valid anchor commit"), expected for an
  empty repo; hooks logged turn-start/turn-end from the first session on.
- First neatlogs trace from `scripts/hello_trace.py` (tag `hello-trace`). `.env` had first been filled with the
  docs page as `LITELLM_BASE_URL`; the real endpoint is `https://litellm.vision.aivar.app/v1`.

### 2026-10-10 — agent core: five runs, seven defects found in traces and outputs

Architecture: `orchestrator.prepare_applications` (WORKFLOW span) runs librarian → program_researcher →
advisor_scout → connector → writer → verifier with a JSON checkpoint per step in `workspace/<applicant>/`; a
re-run skips finished steps. CLI: `uv run python -m hioffer.cli run examples/applicants/priya --program UW`.

| Run (neatlogs tag) | What happened | What the trace / output showed | Fix |
|---|---|---|---|
| `run1` | crashed after 11 page fetches | `program_researcher`'s final JSON did not parse (`Expecting ',' delimiter … char 3102`, unescaped quotes in a `quote` field); same page fetched three times. Library step had checkpointed, so run 2 resumed. `evidence/neatlogs/05-run1-json-error-in-trace.jpg` | `parse_json` asks Haiku to repair once (CHAIN span `repair_json`); identical tool calls are short-circuited |
| `run2` | finished, failed verification 3× on the same issue | (a) coverage check was a substring test and flagged "No separate research statement required" as missing; the writer cannot fix a missing file, so two rewrites were wasted. (b) **`advisor_scout` invented paper ids** (`tsvetkov-magnet-2024`) for papers seen on lab pages; the citation check only compared against the scout's own output. `evidence/2026-10-10-run2-before-fix/` | facts carry `required: yes/no/optional`; missing files become applicant to-dos; scout keeps only works OpenAlex actually returned, the rest go to `unverified_mentions` |
| `run3` (`after-fix`) | verification now caught real fabrications (11 → 6 → 8 issues) | invented project names, papers attributed to the wrong professor, applicant files cited for claims about professors. Root causes: my OpenAlex institution filter dropped faculty whose last-known institution is a lab (3 of 5 advisors had zero verified papers → nothing to cite), no citation type for advisor facts, auditor could not see authors/venues. `evidence/2026-10-10-run3-before-fix/` | soft institution match; advisors without verified papers are `skipped`; `[advisor:<name>]` citations; auditor sees authors/venue/year; per-run cost estimate |
| `run4` (`after-fix-2`), 3 programs | UW passed first draft; UMD failed; Cornell "passed" with 0 advisors | UMD: author lists truncated to 6 made the auditor doubt authorship; a one-digit paper-id typo was treated as fabrication. Cornell: **OpenAlex free daily budget exhausted** (429, `retry-after` ≈ 11 h). Cost: 1.95M input tokens / 71 calls ≈ $6.5 — every step re-sent whole pages. `evidence/2026-10-10-run4/` | full author lists; near-miss ids repaired in code; OpenAlex disk cache + personal key + fail-fast on budget 429; a program with no verified advisors is `blocked`, not complete; old tool results pruned to 600 chars, pages capped at 9k |
| `run5` (`pruned`), Cornell | 3 verified advisors, draft v1 passed | per-call input tokens **27.4k → 13.6k** (run 4 vs run 5), same tool-loop behaviour; ≈ $1.43 for advisors → draft → verify. `evidence/2026-10-10-run5-pruned/`, `evidence/neatlogs/02-run5-trace-tree.jpg` | — |

Later the same day, neatlogs' **Execution Failed** detection (any span with status ERROR) showed three failed
`connector` spans, one of them inside run 5: `'NoneType' object is not iterable` from an OpenAlex record with a
null institution list. Cornell's package had silently skipped the relationship step. Fixing it surfaced a second
null case (authors without an id). `evidence/neatlogs/03-detections-rules.jpg`, `04-execution-failed-flagged-spans.jpg`.

### 2026-10-10 — product

- **Chat first.** FastAPI streams SSE (`tool_start`, `tool_log`, `tool_end`, `card`, `delta`, `final`); the root
  agent talks and "speaks in cards" (programs, requirements with quoted sources, advisor, materials, library,
  todos, signals, offers, recommendations, confirm). Expensive actions show a confirm card first.
- **Layout rework** after the first version: the always-on right panel contradicted "the agent leads". Now a
  left sidebar holds the human-managed pages (Programs, Advisors, Materials, Timeline, Signals, Offers) and the
  conversation history; the chat is the full-width stage; a card opens a preview pane on the right; each page has
  an "Ask hioffer about this page" box. Bugs found while doing it: seeded question created the conversation
  twice; avatar stretched by flex; Next.js 16 needs `useParams` inside `<Suspense>`.
- **UI bug caught in the demo:** "UW" matched nothing (plain substring lookup) and the model then invented "two
  possible candidates". Fixed with `short` aliases, institution matching, and an error that tells the model to
  ask, not guess. The agent's system prompt now carries the program/advisor roster and today's date (it had
  dated a signal "2025" without it).
- hioffer's face is the robot from the cover image (chat avatar, header).

### 2026-10-10 — UI v2 (afternoon)

- Landing page rebuilt to explain what each module does and how far it goes, with a real sample card per
  module rendered from the demo workspace (`web/lib/demo.json`), a transparent applicant + robot mascot cut from
  the cover with `rembg` (no more screenshot-as-avatar), and a "built in public, measured honestly" strip with
  the measured numbers. All emoji replaced by a small inline SVG icon set. The app home is now a brief: greeting
  card, four live counters (programs, verified advisors, drafts verified, to-dos due in 30 days) and a five-line
  "hioffer says" summary computed from server state, so the agent feels ongoing rather than reactive.

### 2026-10-10 — the six modules

1. **Find programs:** `recommend_programs` → five 2-3-word OpenAlex phrases from the applicant's interests →
   2024+ paper counts per US university (hard evidence) → one model call tiers 8-10 institutions reach / match /
   safety, told that selectivity is general knowledge and never to state admit rates, deadlines or fees. First
   attempt with 3-6-word phrases returned 0-1 institutions (OpenAlex ANDs every word); short standard terms gave
   CMU 197, Stanford 116, JHU 87. "Add" puts a program into `workspace/programs_extra.json`.
2. **Assess advisors:** OpenAlex-verified papers only; **identity anchoring** with two sources (faculty page +
   OpenAlex affiliation history; same name alone never counts; all 8 kept advisors anchored "high"); light
   relationship graph (co-author one hop, alumni) with an OpenAlex paper or affiliation as evidence per edge.
3. **Assemble materials:** library from the applicant's files; SOP variant, fit paragraph per advisor, outreach
   email per advisor; every sentence tagged `[lib:]`, `[paper:]` or `[advisor:]`; verifier checks word limits,
   citation resolution, coverage and claims, then the writer revises only what it can fix.
4. **Support the process:** planner turns requirements + advisors into dated to-dos (email each advisor with the
   ready draft, ask/remind recommenders, test scores, transcripts, fee + submit); 23 to-dos across three programs.
5. **Track signals:** email sent / reply ± / interview / waitlist / admit / reject / funding, logged from the page
   or by telling the agent ("Hajishirzi replied, positive").
6. **Decide offers:** deterministic comparison with visible weights (advisor fit 0.35, funding 0.30, signals
   0.20, guarantee 0.15); the agent explains, never overrides. Demo signals/offers are a labelled fictional sample.

### 2026-10-10 — places and mock interview (late afternoon)

- **Programs as places.** The program list now has three modes: requirements, places, map. Each program gets
  coordinates and city from its OpenAlex institution record, last year's climate from the Open-Meteo archive
  (January lows, July highs, rain days; free, sourced), and a short living note from one model call that is
  explicitly labelled "general knowledge, verify" with a link, because there is no free citable cost-of-living
  source. Map is Leaflet + OpenStreetMap, no key. Seattle 1.8/25.9 °C and 127 rain days; Ithaca −7.9/28.7 °C
  and 161 rain days: the kind of thing an applicant from Chennai should see before choosing.
- **Mock interview, by voice.** Per advisor, one model call turns the applicant's library and the advisor's
  verified papers into 7 questions across fit → your project → advisor's papers → methods → future →
  logistics, each with the fact or paper it comes from and what a strong answer includes. The browser speaks
  the question (speechSynthesis) and listens (SpeechRecognition, Chrome; typing always works). Each answer is
  scored fit/depth/clarity 1–5 with blunt feedback and a follow-up; 16 evaluations per interview max. The
  first test answer scored 2/1/3 with the comment that it described dataset construction instead of
  isolating the confounder — exactly the kind of thing an advisor would say. Plans and answers are cached in
  `workspace/priya/interviews/`.
- **Immersive mode (same evening):** the form became a stage. The robot stands in for the professor: it
  speaks the intro and each question (glow ring while speaking, captions below), then listens on its own
  (green ring, live mic level bars from a Web Audio analyser), stops after a 1.8 s pause or 90 s, scores,
  speaks the feedback, and moves to the next question without a click. Interrupt, skip, end, type-instead and
  a collapsible transcript are there; a report with averages and per-question feedback closes the session.
  Ideas taken from the user's earlier career-coaching interview: state-specific looks, no confirm step,
  auto-listen after speaking, caps per turn.

- **Logos and rankings.** Institution logos come from the OpenAlex institution record (Wikimedia). Rankings
  (QS, THE, US News CS, CSRankings) have no free API, so one model call per batch returns approximate positions
  that are labelled `≈ year` on every chip and link to the official ranking pages; the same honesty rule as the
  living notes. Recommendations now also show a tier-coloured map (reach / match / safety).

### 2026-10-10 — stress test with a second applicant (evening)

- New fictional applicant `examples/applicants/arjun` (robotics / embodied AI, M.Tech at IISc, different file
  mix, programs the agent has never seen: Michigan Robotics, CMU RI). Georgia Tech was dropped before the run
  because both its pages returned 404 — a program the researcher cannot fetch is reported as not found, but the
  test should exercise the pipeline, not a dead link.
- **Finding 1 (before any model call):** `--program UMich` matched nothing because the CLI filter only looked
  at the full program name, and the run then "succeeded" with an empty program list ($0.04 spent on the library).
  Fixed: the filter matches name, short alias and institution, and an empty match now exits with the known names.

- **Run (tags `stress-test`, `arjun-umich`):** complete, end to end, on a field the prompts were never tuned
  for. 11 sourced facts (writing sample and research statement correctly "not found"); 5 advisors kept with
  OpenAlex-verified papers (4 identities anchored high, 1 medium), 4 skipped with a stated reason (e.g. "soft
  robotics and fabrication focus; no clear overlap"); draft v0 failed once because the writer computed
  "34 and 32 percentage points over the baseline" from the CV's raw numbers and the auditor refused a number
  not literally in a source — strict, but the safe direction — and v1 passed. **Cost: $0.83 for the whole
  program** (20 Sonnet calls, 188k input tokens), versus ≈ $2.2 per program in run 4 before pruning. Evidence:
  `evidence/2026-10-10-stress-test-arjun/`.
- **Finding 2:** none of the robotics-specific gaps I expected appeared; the general design (sourced facts,
  verified papers, tagged sentences) held. What did not transfer: the home brief greets "Priya" by name and the
  demo workspace is single-applicant; multi-applicant state is the next structural step.

### 2026-10-10 — a question from X changed the verifier (night)

- The first reply to the build-in-public posts asked whether the verifier checks paper ids against OpenAlex
  itself or trusts the scout. Honest answer at the time: the scout's tool wrapper captured what OpenAlex
  returned and dropped anything else, and the verifier resolved citations against that captured set, but it
  never re-queried OpenAlex. Now it does: every cited id is fetched again at verification time and must
  match **both id and title** (existence alone proves nothing: almost any W-number resolves to some paper,
  which the first version of this check got wrong for a minute). Tested: 5/5 real UW citations pass; a wrong
  id with a real title fails; a real id with an invented title fails. Cached, so it costs nothing on re-runs.

### 2026-10-10 — business plan and cost

- **cfo.ai** (public model: https://cfo.ai/s/A_qiW6hIGmm-3fDR; inputs `business/cfo-ai-inputs.md`, results
  `business/cfo-ai-results.md`, screenshots `evidence/cfo-ai/`). Max COGS for a 60% margin at $49 is **$19.60**;
  445 → 300 paying users/month cover two $6k founder salaries. Non-obvious finding: with 70% of sales in Oct–Dec,
  the $150k pre-seed scenario runs out of cash in **August of Year 2** ($17,650 short) right before the peak;
  bootstrapping needs a ~$900 bridge. Decision: bootstrap the first cycle, pre-sell in Aug–Sep.
- **Cheaper routing, negative result.** `HIOFFER_RESEARCH_MODEL=claude-haiku` on the Cornell requirements task:
  12 calls, $0.20, the same page re-requested eleven times, **0 facts** (its final message was a tool call
  written as text); Sonnet: 12 sourced facts from 22 pages. So the "$22 → $9" assumption is not yet earned; the
  proven lever is context pruning. `evidence/2026-10-10-haiku-vs-sonnet/`.

## Evidence index

- `evidence/neatlogs/` — traces list, run 5 trace tree, detection rules, flagged spans, run 1 error.
- `evidence/entire/` — `entire checkpoint list` (28 checkpoints on Oct 10, one per commit, each with the prompt
  that led to it), recap, one checkpoint in full.
- `evidence/cfo-ai/` — assumptions page, monthly P&L and cash flow, funding-gap simulator.
- `evidence/2026-10-10-run*` — raw outputs before and after each fix (verification files, advisors, materials).

## Demo

- Live: https://hioffer-one.vercel.app/app (try "Who are the best-fit advisors at UW?", "Where else should I
  apply?", "Show my UW drafts"). Deep links: `/app?q=<question>`.
- Video v1 (Oct 10): https://x.com/vibedding/status/2108959614410670096 (pipeline in `demo/`; v2 planned Oct 11)
- Reproduce: README → Setup / Run. Demo applicant is fictional (`examples/applicants/priya/README.md`).

## Known limitations and next steps

- Faculty discovery depends on the department page being fetchable and on OpenAlex disambiguation; unmatched
  faculty are listed as skipped, never guessed.
- Requirements come only from pages the researcher could fetch (Cornell's fee page returned 403 → "not found").
- The relationship graph finds nothing for the fictional applicant (no OpenAlex presence), which is correct.
- Cheaper-model routing is unproven (see above); cost per program is ≈ $2 at list price.
- One applicant per workspace, no accounts; state is JSON files (a Supabase table per file would be the next step).
- Modules 5 and 6 hold data and a transparent scorer; they do not yet read the applicant's inbox.

## Submission checklist

- [x] Public repo with hackathon-dated commits — https://github.com/haodaz/hioffer
- [x] neatlogs traces (before/after a fix, failure recovery) — `evidence/neatlogs/`, build log table
- [x] Entire checkpoints — `evidence/entire/`, refs pushed to the repo
- [x] cfo.ai business plan — https://cfo.ai/s/A_qiW6hIGmm-3fDR
- [ ] Demo video (≤3 min) covering neatlogs, Entire, cfo.ai
- [x] Public posts on X with #neatHack — day 1: https://x.com/vibedding/status/2108912402540458190 · day-1 wrap: https://x.com/vibedding/status/2108953313676771343 · demo v1 video: https://x.com/vibedding/status/2108959614410670096 · day 2 (negative result + $0.83 run): https://x.com/vibedding/status/2109013776892584442 · map mode: https://x.com/vibedding/status/2109038819521499495
- [ ] Quote post of the official neatlogs post during the submission window (Oct 12, 7:00–11:55 PM IST)

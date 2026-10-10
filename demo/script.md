# Demo video script (≤ 3 min)

Target 2:45. Screen recording of the app + neatlogs + Entire + cfo.ai, English voice-over, captions on.
Each line: [time] what is on screen — what is said.

## 0:00–0:15 Hook (landing page)
Screen: https://hioffer-one.vercel.app, cover image.
> PhD applicants mostly apply on their own. The hard parts are finding advisors who actually fit, and
> handling ten programs with slightly different rules. hioffer is an agent that does that work, and shows
> its sources for every claim.

## 0:15–0:45 The agent, end to end (app, chat)
Screen: `/app?q=Show my programs` → programs card; click "Who are the best-fit advisors at UW?".
> One goal in: prepare my applications. The agent builds a material library from the applicant's files,
> reads each program's official pages and keeps the quoted text for every requirement, finds faculty
> whose recent papers match, verifies those papers against OpenAlex, anchors each professor's identity
> with two sources, then writes a tailored statement and outreach emails, every sentence tagged with
> where it came from. A verifier checks word limits, citations and claims, and sends failures back.

## 0:45–1:05 Cards and the human boundary
Screen: advisor card (identity line, papers, connections), materials card (SOP, citations toggle,
copy email), timeline panel with dated to-dos.
> The agent talks, and it answers in cards you can act on. It never sends an email, pays a fee or
> submits. Those become dated to-dos on the timeline. Expensive runs ask for confirmation first.

## 1:05–1:50 neatlogs: finding the failure, proving the fix
Screen: neatlogs traces filtered by tag `run1` → the trace that ended in JSONDecodeError; then tag
`run3` → verifier span with 11 claim issues; then `run4` → UW passed; then run4 vs run5 token counts.
> Every run is one trace: the workflow, one span per sub-agent, one per tool call. Run 1 died on a
> malformed JSON reply; the trace showed exactly which page it was parsing. Run 3 is the one I'm
> proud of: the verifier caught the writer inventing a paper title, and the trace led to the real bug,
> my OpenAlex filter had thrown away the professor's actual papers, so the writer had nothing to cite.
> After the fix, run 4 passed on the first draft. The traces also showed every step re-sending whole
> web pages; pruning old tool results halved input tokens per call, run 4 to run 5.

## 1:50–2:15 Entire
Screen: `entire checkpoint list` in the terminal, then the GitHub repo with the Entire refs; open one
checkpoint and show the session prompt that produced the commit.
> Entire recorded the coding sessions behind each commit. Every fix in the build log maps to a
> checkpoint with the conversation that produced it, so judges can trace a line of code back to the
> reasoning.

## 2:15–2:40 cfo.ai
Screen: cfo.ai dashboard: P&L, gross margin, break-even, runway A vs B.
> Pricing comes from the traces. A program costs about two dollars of model time today, nine dollars
> per applicant once research runs on a cheaper model. A $49 season pass, below a single application
> fee, keeps a 55 to 80 percent gross margin, and cfo.ai shows the bootstrapped path is cash-positive
> in the first admissions cycle.

## 2:40–2:50 Close
Screen: repo + hackathon.md.
> Everything is public: the repo, the build log with every failure, the traces. hioffer, built in
> public for neatHack.

## Recording checklist
- API server on 8000, web on 3000, workspace populated (UW, UMD, Cornell complete).
- Pre-open tabs: landing, /app, neatlogs (filters saved), GitHub repo, cfo.ai.
- Use `/app?q=...` deep links so each chat starts instantly.
- Record at 1600×1000, captions burned in (see the demo-video skill on this machine).

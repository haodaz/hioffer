# Build-in-public posts (schedule and copy)

Times are US Eastern. Submission window: Mon Oct 12, 9:30 AM–2:25 PM ET (7:00–11:55 PM IST).
Only post what is true on the day. Fill [brackets] before posting.

## 1 · Sat evening — demo video v1 (post now)

HiOffer demo, day 1 of #neatHack (2:54).

A PhD-application agent that shows its sources: requirements quoted from official pages, advisors matched on OpenAlex-verified papers, drafts with every sentence traced, a timeline of what only you can do.

Also in the video: the bug neatlogs caught that I'd missed, 28 Entire checkpoints in one day, and the cfo.ai finding that raising money would run out of cash before the sales peak.

Live: hioffer-one.vercel.app · Repo: github.com/haodaz/hioffer
https://youtu.be/ANmeUiV3tBw

## 2 · Sun morning — the honest negative result

Day 2 of #neatHack starts with a number I didn't like.

I tried routing HiOffer's research loops to a cheaper model to hit the $9 cost-per-user my cfo.ai plan assumes. Haiku re-fetched the same page eleven times and returned zero facts. Sonnet: 12 sourced facts from 22 pages.

So the plan's "$22 → $9" line is unproven. Logged it in the build log instead of hiding it. The lever that *is* proven: pruning old tool results halved input tokens per call.

[screenshot: evidence/neatlogs/02-run5-trace-tree.jpg or the hackathon.md run table]

## 3 · Sun midday — map mode (post after it ships)

New in HiOffer: card + map mode for your program list.

Four to five years in a place is not just a lab. Each program now shows where it is, the climate, and what living there costs, next to the deadline and the advisors. Coordinates come from OpenAlex's institution records; the living notes are labelled as general knowledge, not data.

[screenshot of the map view] #neatHack

## 4 · Sun afternoon — mock interview (post after it ships)

New in HiOffer: a mock interview, by voice.

It reads your materials and the advisor's recent papers, then asks what that professor would plausibly ask: about your tokenizer result, about their evaluation paper, about why this lab. You answer out loud; it gives feedback and a follow-up.

It will not pretend to know what the real interview holds. It just makes you say the hard parts once before you have to. #neatHack

[short screen recording]

## 5 · Sun evening — stress test + video v2

Stress test #2: a third fictional applicant, a third field. HCI undergrad, Cornell Information Science, pages the agent had never seen.

Result: complete in one run, $0.94. 11 requirements quoted from official pages. 4 advisors, every identity anchored, papers OpenAlex-verified. One professor skipped, not guessed, after four lookups couldn't pin her name.

What broke: the writer turned the CV's "2.3× more errors caught" into "tripled". The verifier refused the paraphrased number; draft v1 passed.

All three applicants are live with demo codes. Updated demo (v2): https://youtu.be/ANmeUiV3tBw
Every failure is in hackathon.md with the trace that found it. #neatHack

## 6 · Mon, submission window — the quote post (must be a quote of the official neatlogs post)

Rules (neatlogs announcement x.com/neatlogs/status/2109582053562032266): quote the official @neatlogs
*launch* post that goes live at 7:00 PM IST (9:30 AM ET), not the announcement; include the demo video and tag
@neatlogs, @EntireHQ and @arithecfo; then fill the submission form (link shared later). Both steps required.

Submitting HiOffer to #neatHack.

Team: @vibedding (solo)
Project: HiOffer, a PhD-application agent that shows its sources
Repo: github.com/haodaz/hioffer
Demo: https://youtu.be/ANmeUiV3tBw · Live: hioffer-one.vercel.app
Business plan (cfo.ai): cfo.ai/s/A_qiW6hIGmm-3fDR

Traced with @neatlogs, checkpointed with @EntireHQ, priced with @arithecfo. Build log with every failure and fix in the repo. #neatHack

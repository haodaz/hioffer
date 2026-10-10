# Build-in-public posts (schedule and copy)

Times are US Eastern. Submission window: Mon Oct 12, 9:30 AM–2:25 PM ET (7:00–11:55 PM IST).
Only post what is true on the day. Fill [brackets] before posting.

## 1 · Sat evening — demo video v1 (post now)

HiOffer demo, day 1 of #neatHack (2:54).

A PhD-application agent that shows its sources: requirements quoted from official pages, advisors matched on OpenAlex-verified papers, drafts with every sentence traced, a timeline of what only you can do.

Also in the video: the bug neatlogs caught that I'd missed, 28 Entire checkpoints in one day, and the cfo.ai finding that raising money would run out of cash before the sales peak.

Live: hioffer-one.vercel.app · Repo: github.com/haodaz/hioffer
[YouTube link]

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

Stress test: a second fictional applicant, different field, from zero to a complete package.

[What broke: …] [What the trace showed: …] [What I changed: …]

Updated demo (v2): [YouTube link]
Every failure is in hackathon.md with the trace that found it. #neatHack

## 6 · Mon, submission window — the quote post (must be a quote of the official neatlogs post)

Submitting HiOffer to #neatHack.

Team: @vibedding (solo)
Project: HiOffer, a PhD-application agent that shows its sources
Repo: github.com/haodaz/hioffer
Demo: [YouTube link] · Live: hioffer-one.vercel.app
Business plan (cfo.ai): cfo.ai/s/A_qiW6hIGmm-3fDR

Traced with neatlogs, checkpointed with Entire, priced with cfo.ai. Build log with every failure and fix in the repo.

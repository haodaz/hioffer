# cfo.ai inputs for hioffer

Assumptions prepared on 2026-10-10 from measured runs (see `hackathon.md` and `evidence/`). Paste the
"Prompt for cfo.ai" section into cfo.ai's chat; the tables are the source of each number.

## Measured unit cost (what one applicant costs us)

| Item | Measured | Note |
|---|---|---|
| Model cost per program, before context pruning | ≈ $2.2 (list price) | run 4: 3 programs, 1.95M input tokens, ≈ $6.5 |
| Model cost per program, after pruning | ≈ $1.4 + ≈ $0.7 requirements ≈ **$2.1** | run 5 (advisors → draft → verify) 408k input tokens; per-call input halved; requirements stage reused from cache |
| OpenAlex | ≈ $0.05 per program | $0.001 per call, ~50 calls |
| Web fetches | $0 | official pages |
| Chat turns (per applicant per season) | ≈ $0.50 | ~30 turns × $0.015 |

An applicant applies to **8–12 programs** on average. Cost of goods per applicant per season:
- Today (Sonnet for every stage): 10 × $2.15 + $0.5 ≈ **$22**
- Planned (Haiku for the research tool loops, Sonnet only for writing and verification): ≈ **$9**

## Pricing (below one application fee, which is $75–$125 in the US)

| Tier | Price | Includes |
|---|---|---|
| Free | $0 | 1 program: requirements + advisors + one draft |
| Season Pass | **$49** one-off | up to 12 programs, timeline, unlimited revisions for one admission cycle |
| Plus (later) | $99 | Season Pass + human proofread of the final SOP |

Gross margin per Season Pass: $49 − $22 = $27 today (55%); $49 − $9 = $40 planned (82%).

## Market and growth assumptions (deliberately conservative)

- US graduate programs receive ~2M applications per cycle; CS PhD applicants alone are tens of thousands
  (UW CSE reports ~3,500 applicants per year for one department).
- Target segment year 1: international CS/engineering PhD applicants (India, China, etc.) who apply on their own.
- Conversion: 15% of free users buy a Season Pass.
- Seasonality: 70% of purchases land in Oct–Dec.

| Year | Free users | Season Pass buyers | Revenue | COGS |
|---|---|---|---|---|
| 1 (2027 cycle) | 15,000 | 2,000 | $98k | $44k (at $22) → $18k (at $9) |
| 2 | 60,000 | 9,000 | $441k | $81k |
| 3 | 150,000 | 25,000 | $1.2M | $225k |

## Fixed costs

| Item | Monthly |
|---|---|
| Two founders, no salary for 12 months, then $6k each | $0 → $12k |
| Hosting (Vercel + one container + storage) | $150 |
| neatlogs Pro, Entire, misc. SaaS | $300 |
| Marketing (content, student communities, one campus ambassador program) | $1,500 |

## Funding and runway

- Scenario A, bootstrapped: $0 raised; monthly burn ≈ $2k; year-1 revenue $98k covers it → cash-positive from month 3 of the first cycle.
- Scenario B, $150k pre-seed: adds one engineer at month 6 ($8k/mo) and $5k/mo marketing → runway > 18 months even with zero revenue.

## Prompt for cfo.ai

> Build a 3-year financial model for "hioffer", a PhD-application agent sold to applicants directly.
> Product: one-off Season Pass at $49 (up to 12 programs per admission cycle), free tier with 1 program.
> Cost of goods per paying user: $22 today, falling to $9 from month 7 (cheaper model routing).
> Users: 15,000 free / 2,000 paying in year 1, 60,000 / 9,000 in year 2, 150,000 / 25,000 in year 3;
> 70% of purchases in Oct–Dec. Fixed costs: hosting $150/mo, SaaS $300/mo, marketing $1,500/mo; two
> founders unpaid for 12 months then $6k/mo each. Show P&L, cash flow, gross margin, break-even month and
> runway for (A) bootstrapped and (B) a $150k pre-seed that adds one $8k/mo engineer at month 6 and raises
> marketing to $5k/mo. Then answer: what is the maximum cost of goods per user at which a $49 price still
> leaves a 60% gross margin, and how many paying users are needed to pay two $6k salaries?

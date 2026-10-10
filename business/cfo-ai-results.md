# cfo.ai results for hioffer (2026-10-10)

Built in cfo.ai ("Ari") from the assumptions in `cfo-ai-inputs.md`, as a hypothetical model
(no real accounts connected). Screenshots in `evidence/cfo-ai/`. Model horizon Jan 2027–Dec 2029,
zero opening cash, upfront collection, 70% of purchases in Oct–Dec.

## What Ari built
- Pages: *hioffer — Assumptions* (editable drivers: annual user targets, pass price, early/later COGS,
  routing-change month, seasonality, fixed costs, funding, team pay schedule) and *hioffer — Financial
  outlook* (monthly P&L and cash flow, Jan-27 → Dec-29), plus scenario *B — $150k pre-seed* and a
  seasonal cash-forecast simulator.

## Numbers (from the model, not from me)
| Item | Value |
|---|---|
| Year 1: revenue / COGS / gross profit / gross margin | $98,000 / $23,200 / $74,800 / 76.3% |
| Year 1 EBITDA (founders unpaid) | $51,400 |
| Year 2: revenue / COGS / gross profit | $441,000 / $81,000 / $360,000 (GM 81.6%) |
| Year 2 fixed costs incl. two $6k founder salaries | $192,600 |
| Year 3 operating profit | ≈ $832,600 |
| Maximum COGS per paying user for a 60% gross margin at $49 | **$19.60** |
| Contribution per buyer, early ($22 COGS) / later ($9 COGS) | $27.00 (55.1%) / $40.00 (81.6%) |
| Paying users needed per month to cover two $6k salaries | **445** at early COGS, **300** at later COGS |
| … per year | 5,334 / 3,600 |

## Cash and runway — the finding that changed the plan
- **Scenario B ($150k pre-seed, engineer from month 6, $5k/mo marketing):** the seasonal cash forecast
  shows the cash running out in **August of Year 2**, a **$17,650 shortfall** right before the Oct–Dec
  sales peak, even though the year is profitable overall. Seasonality, not margin, is the risk.
- **Scenario A (bootstrapped):** the lowest month-end balance needs only a **≈ $900 bridge**.
- Both cases are profitable month by month from Year 3. Simulator readout for the bootstrapped case: cash-out
  month Jan-27, lowest month-end cash **−$900**, first profitable month **Jul-27**, profitable every month
  from **Oct-28**, December 2029 cash **$1,076,600**.
- Ari flagged what the inputs did not cover: free-tier delivery cost, taxes, fees, capex, working-capital delays.

## Decisions taken from this
1. Keep the $49 Season Pass; the $19.60 COGS ceiling confirms the Haiku-routing work (target $9) is the
   lever that matters, and today's $22 is above the 60% line.
2. Prefer the bootstrapped path for the first cycle; if raising, size spending so that cash survives
   the Jan–Sep trough, or time the hire after the first October peak.
3. Pre-sell Season Passes in Aug–Sep (early-bird) to flatten the seasonality that creates the gap.

"""Decider: transparent, deterministic comparison of offers.

Each offer gets four sub-scores (0-1) and a weighted total. Nothing here calls a model; the chat agent
only explains the table. Weights are visible so the applicant can argue with them.
"""

WEIGHTS = {"advisor_fit": 0.35, "funding": 0.30, "signals": 0.20, "guarantee": 0.15}

POSITIVE = {"reply_positive", "interview", "admit", "funding_offer"}
NEGATIVE = {"reply_negative", "reject"}


def compare_offers(offers: list[dict], advisors_by_program: dict[str, dict], signals: list[dict]) -> dict:
    stipends = [o.get("stipend_usd") or 0 for o in offers]
    max_stipend = max(stipends) if stipends and max(stipends) > 0 else 1
    rows = []
    for o in offers:
        adv = advisors_by_program.get(o["program"], {}).get("advisors", [])
        named = next((a for a in adv if o.get("advisor") and a["name"].lower() == o["advisor"].lower()), None)
        fit_raw = (named or (max(adv, key=lambda a: a.get("fit_score", 0)) if adv else {})).get("fit_score", 0)
        sig = [s for s in signals if s.get("program") == o["program"]]
        pos = sum(1 for s in sig if s.get("kind") in POSITIVE)
        neg = sum(1 for s in sig if s.get("kind") in NEGATIVE)
        sub = {
            "advisor_fit": fit_raw / 5,
            "funding": (o.get("stipend_usd") or 0) / max_stipend,
            "signals": max(0.0, min(1.0, 0.5 + 0.15 * pos - 0.3 * neg)),
            "guarantee": min((o.get("years_guaranteed") or 0), 5) / 5,
        }
        total = round(sum(WEIGHTS[k] * v for k, v in sub.items()), 3)
        reasons = [
            f"advisor fit {fit_raw}/5" + (f" ({named['name']})" if named else " (best match at program)"),
            f"stipend ${o.get('stipend_usd') or 0:,}/yr, {o.get('years_guaranteed') or 0} yr guaranteed",
            f"{pos} positive / {neg} negative signal(s)",
        ]
        rows.append({**o, "subscores": {k: round(v, 2) for k, v in sub.items()}, "total": total, "reasons": reasons})
    rows.sort(key=lambda r: -r["total"])
    return {"weights": WEIGHTS, "ranked": rows}

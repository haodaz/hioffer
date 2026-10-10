"""Connector: light relationship graph between the applicant's circle and each advisor.

Two edge types only, both with evidence:
- coauthor: someone in the applicant's circle (recommender, mentor, co-author) wrote a paper with the
  advisor, or shares a co-author with them (one hop).
- alumni: the advisor's OpenAlex affiliation history includes an institution from the applicant's history.
Deterministic: the LLM only extracts the applicant's circle from the library once.
"""
import neatlogs

from ..llm import complete_json
from ..tools.scholar import author_profile, coauthors, find_author

EXTRACT = """From a PhD applicant's material library, list the people and institutions in their circle.
Return JSON: {"people": [{"name": full name without titles, "role": "recommender|mentor|coauthor|advisor",
                          "institution": str}],
              "institutions": [distinct institution names the applicant studied or worked at]}"""


@neatlogs.span(kind="AGENT", name="connector")
def find_connections(library: dict, advisors: dict, log=print) -> dict:
    facts = "\n".join(f"[{i['id']}] {f}" for i in library["items"] for f in i["key_facts"])
    net = complete_json(EXTRACT, facts)
    circle = {}
    for person in net.get("people", []):
        cands = find_author(person["name"], person.get("institution", "")).get("candidates", [])
        if not cands or (person.get("institution") and not cands[0]["institution_match"]):
            circle[person["name"]] = {**person, "openalex": None, "coauthors": {}}
            continue
        cid = cands[0]["id"]
        co = {c["id"]: c for c in coauthors(cid).get("coauthors", [])}
        circle[person["name"]] = {**person, "openalex": cid, "coauthors": co}
    inst_lower = [s.lower() for s in net.get("institutions", [])]

    for adv in advisors.get("advisors", []):
        edges = []
        aid = adv.get("openalex_id")
        if not aid:
            adv["connections"] = edges
            continue
        adv_co = {c["id"]: c for c in coauthors(aid).get("coauthors", [])}
        for name, p in circle.items():
            if not p["openalex"]:
                continue
            if p["openalex"] in adv_co:
                ex = adv_co[p["openalex"]]["example"]
                edges.append({"type": "coauthor", "via": name, "role": p["role"], "hops": 1,
                              "evidence": f"co-authored '{ex['title']}' ({ex['year']})",
                              "source_url": f"https://openalex.org/{ex['id']}"})
            shared = set(p["coauthors"]) & set(adv_co)
            for sid in list(shared)[:3]:
                ex = adv_co[sid]["example"]
                edges.append({"type": "shared_coauthor", "via": name, "role": p["role"], "hops": 2,
                              "through": adv_co[sid]["name"],
                              "evidence": f"{name} and the advisor both published with {adv_co[sid]['name']} "
                                          f"(e.g. '{ex['title']}', {ex['year']})",
                              "source_url": f"https://openalex.org/{ex['id']}"})
        prof = author_profile(aid)
        for aff in prof["affiliations"]:
            inst = (aff["institution"] or "").lower()
            if any(i and (i in inst or inst in i) for i in inst_lower):
                yrs = aff["years"]
                edges.append({"type": "alumni", "via": aff["institution"], "hops": 1,
                              "evidence": f"advisor affiliated with {aff['institution']} "
                                          f"{min(yrs)}–{max(yrs)}" if yrs else f"advisor affiliated with {aff['institution']}",
                              "source_url": prof["url"]})
        adv["connections"] = edges
        log(f"  [connector] {adv['name']}: {len(edges)} connection(s)")
    advisors["circle"] = [{"name": n, "role": p["role"], "openalex": p["openalex"]} for n, p in circle.items()]
    return advisors

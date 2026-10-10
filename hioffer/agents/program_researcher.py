"""Program researcher: read official pages and extract requirements with sources."""
from ..config import RESEARCH_MODEL
from ..llm import parse_json, run_tool_agent
from ..tools.web import FETCH_PAGE

SYSTEM = """You research the official application requirements of ONE PhD program.
Start from the given URL. Follow links on the official site (requirements, how to apply, FAQ, deadlines,
fees, statements, letters) until you have covered the checklist below or run out of useful pages.
Never use memory or guesses: every fact must come from a page you fetched in this run, with a verbatim quote.
If a fact is not on the pages, say "not found" and list which pages you checked.

Return JSON:
{"program": name, "start_url": url,
 "facts": [{"key": one of ["deadline","application_fee","fee_waiver","statement_of_purpose","personal_statement",
                           "research_statement","letters_of_recommendation","cv","transcripts","gre","toefl_ielts",
                           "writing_sample","other"],
            "required": one of ["yes","no","optional","unknown"]  (is this item required from the applicant?),
            "value": concise statement (include numbers, word/page limits, counts),
            "source_url": url you fetched, "quote": verbatim sentence(s) from that page (max 60 words)}],
 "not_found": [keys not found], "pages_checked": [urls],
 "notes": anything an applicant must know (e.g. deadline is strict, letters due with application)}"""


def research_program(name: str, start_url: str, log=print) -> dict:
    text = run_tool_agent(
        name="program_researcher",
        model=RESEARCH_MODEL,
        system=SYSTEM,
        user=f"Program: {name}\nStart URL: {start_url}\nChecklist: deadline, application fee and waivers, "
        f"statement(s) required with word/page limits, number of recommendation letters, CV, transcripts, GRE policy, "
        f"English test policy, writing sample.",
        tools=[FETCH_PAGE],
        max_steps=10,
        log=log,
    )
    return parse_json(text)

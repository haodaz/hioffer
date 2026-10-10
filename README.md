# hioffer

A PhD-application agent, built for neatHack (Oct 10-12, 2026).

Give it one goal, e.g. *"prepare my applications to these 3 CS PhD programs"*, and it:

1. Builds a **material library** from the applicant's files (CV, SOP, research statement, writing samples, recommenders).
2. Researches each program's **official requirements** (deadlines, word limits, documents, letters, fee), keeping the source URL and quoted text for every fact.
3. Finds **faculty whose recent work matches** the applicant's interests (department pages + OpenAlex / Semantic Scholar), with cited papers as evidence, and flags whether they appear to take students.
4. **Tailors materials** per program (fit paragraph per advisor, SOP variant within limits) and drafts outreach emails.
5. **Verifies its own output** (word limits, every claim traced to a source, checklist coverage), revises what fails, and checkpoints state so a crashed run resumes.

The human sends emails, pays fees and submits. The agent never does.

## Hackathon tooling

- **neatlogs** traces every agent run (model/tool calls, tokens, cost).
- **Entire** records the coding-agent sessions behind each commit.
- **cfo.ai** holds the business plan (pricing, costs, revenue, runway).

See [hackathon.md](hackathon.md) for the build log and evidence.

## Setup

```bash
cp .env.example .env   # then fill in the keys
```

More to come as the agent is built.

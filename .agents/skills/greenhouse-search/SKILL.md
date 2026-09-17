---
name: greenhouse-search
version: 1.0.0
description: >
  Use this skill to search live job listings hosted on Greenhouse job boards — the
  applicant tracking system behind thousands of US and international employers.
  It searches a configured list of company board slugs (companies.txt) and filters
  client-side by keyword, location, and posting age, so it is best for a targeted
  employer list rather than open-ended keyword trawling. Trigger phrases: search
  Greenhouse jobs, jobs at <company>, Greenhouse board, open roles at <company>,
  careers page search, ATS search, "is <company> hiring".
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/greenhouse-search/cli/src/cli.ts *)
---

# Greenhouse Search Skill

Search live job postings from **Greenhouse** public job boards. Greenhouse hosts one
board per employer, addressed by a **company slug**. This skill fans out across a
list of slugs, normalizes every posting into the repo's shared job shape, and
filters client-side.

No authentication, no API key, and **zero runtime dependencies** — it runs with
just `bun`.

> Because Greenhouse is an ATS rather than a job portal, there is no global search
> across all employers. You supply the target list. That suits a senior search,
> where the employer list is the strategy, but it means the skill finds nothing
> at a company you have not listed.

## Target companies

Default slugs live in `.agents/skills/greenhouse-search/companies.txt`, one per
line (`#` starts a comment). Edit that file to match your target employers, or
override per call with `--company`.

A company's slug is the path segment in its board URL, for example
`https://boards.greenhouse.io/stripe` → `stripe`.

## Commands

```bash
bun run .agents/skills/greenhouse-search/cli/src/cli.ts search [flags]
bun run .agents/skills/greenhouse-search/cli/src/cli.ts detail <company>:<id> [--format json|plain]
```

| Flag | Meaning |
|------|---------|
| `--query`, `-q` | Keyword filter on title + company. All terms must match. |
| `--company`, `-c` | Comma-separated board slugs. Repeatable. Defaults to `companies.txt`. |
| `--location`, `-l` | Substring filter on the posting's location. |
| `--jobage <days>` | Only postings published within N days. |
| `--page <n>` | 1-indexed page. Default 1. |
| `--limit`, `-n` | Results per page. Default 25. |
| `--format` | `json` (default), `table`, or `plain`. |

## Examples

```bash
# Everything recent across your whole target list
bun run .agents/skills/greenhouse-search/cli/src/cli.ts search --jobage 14 --format table

# Program management roles, any target company
bun run .agents/skills/greenhouse-search/cli/src/cli.ts search -q "program manager" --format table

# One employer, filtered to Florida
bun run .agents/skills/greenhouse-search/cli/src/cli.ts search -c stripe -l "FL" --format table

# Remote-friendly senior roles posted this month
bun run .agents/skills/greenhouse-search/cli/src/cli.ts search -q "senior" -l "remote" --jobage 30 --format table

# Read one posting in full
bun run .agents/skills/greenhouse-search/cli/src/cli.ts detail stripe:12345 --format plain
```

## Output

`search` with `--format json` (the default):

| Field | Meaning |
|-------|---------|
| `meta.count` | Results on this page |
| `meta.total` | Results matching before pagination |
| `meta.companies_searched` | How many slugs were fetched |
| `meta.companies_unavailable` | Slugs that 404'd or failed, so you can prune them |
| `results[].id` | Composite `<company>:<nativeId>`, the handle for `detail` |
| `results[].title` / `.company` / `.location` / `.date` / `.url` | Standard fields, `null` when absent |

Errors go to **stderr** as `{"error": "...", "code": "..."}` with exit code 1.

## Notes

- Greenhouse serves one board per company slug. The slug is the segment in `boards.greenhouse.io/<slug>` or `job-boards.greenhouse.io/<slug>`. No authentication, no rate limit published; keep volume low anyway.
- Filtering is client-side because the API serves a whole board per request. Keep
  `companies.txt` to employers you actually target; every slug is one HTTP call.
- A slug that 404s is reported in `meta.companies_unavailable` rather than failing
  the run, so one dead slug never kills a search.
- Results are sorted newest first by posting date.

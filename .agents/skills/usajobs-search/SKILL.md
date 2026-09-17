---
name: usajobs-search
version: 1.0.0
description: >
  Use this skill to search live U.S. federal government job announcements via the
  official USAJOBS Search API operated by the Office of Personnel Management. It
  covers every agency and department, supports salary floors, location radius,
  remote-eligible filtering, and agency targeting, and returns published salary
  ranges (federal postings state pay, unlike most private listings). Requires a
  free API key. Trigger phrases: federal jobs, government jobs, USAJOBS, GS
  positions, civil service, agency openings, DoD jobs, "is the government hiring",
  federal contractor to civil service, clearance jobs.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/usajobs-search/cli/src/cli.ts *)
---

# USAJOBS Search Skill

Search live federal job announcements from **[USAJOBS](https://www.usajobs.gov)**
through the official Search API at `data.usajobs.gov`. Every U.S. federal agency
posts here by law, so coverage is complete rather than best-effort.

Zero runtime dependencies, but **unlike the other portal skills this one needs a
free API key**.

## Setup

1. Request a key at **<https://developer.usajobs.gov/APIRequest>**. It is free,
   there is no per-call charge, and approval is typically same-day by email.
2. Export both values. The email must be the address the key was issued to,
   because USAJOBS authenticates on the `User-Agent` header as well as the key:

   ```bash
   export USAJOBS_EMAIL="you@example.com"
   export USAJOBS_API_TOKEN="the key from the email"
   ```

   Put them in `~/.claude/.env` or your shell profile. **Never** pass them as CLI
   flags and never commit them: flags leak into shell history and process
   listings, and the repo `.gitignore` already covers `.env`.

If either variable is unset the CLI exits 1 with
`{"error": "...", "code": "MISSING_CREDENTIALS"}` rather than sending an
unauthenticated request that fails confusingly. A bad key exits 1 with
`AUTH_REJECTED`.

## Commands

```bash
bun run .agents/skills/usajobs-search/cli/src/cli.ts search [flags]
bun run .agents/skills/usajobs-search/cli/src/cli.ts detail <control number> [--format json|plain]
```

| Flag | Meaning |
|------|---------|
| `--query`, `-q` | Keyword search across the whole announcement, including synonyms. |
| `--title`, `-t` | Match the job title only, treated as "contains". |
| `--location`, `-l` | City or installation, e.g. `"Boca Raton, Florida"`. Semicolon-delimited for multiple. |
| `--organization` | Agency subelement code, e.g. `TR` for Treasury. |
| `--minsalary <usd>` | Minimum salary. See the bucketing note below. |
| `--remote` | Only remote-eligible announcements. |
| `--jobage <days>` | Posted within N days. **0-60 is the API ceiling.** |
| `--page <n>` | 1-indexed page. Default 1. |
| `--limit`, `-n` | Results per page, up to 500. Default 25. |
| `--format` | `json` (default), `table`, or `plain`. |

## Examples

```bash
# Program management roles at or above a $140k floor
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "program manager" --minsalary 140000 --format table

# Title-anchored search near home
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -t "Program Manager" -l "Boca Raton, Florida" --format table

# Remote-eligible technical roles posted in the last two weeks
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "systems engineer" --remote --jobage 14 --format table

# One agency only (TR = Department of the Treasury)
bun run .agents/skills/usajobs-search/cli/src/cli.ts search --organization TR --minsalary 125000 --format table

# Read one announcement in full, including qualifications
bun run .agents/skills/usajobs-search/cli/src/cli.ts detail 21947200 --format plain
```

## Output

`search` with `--format json` (the default):

| Field | Meaning |
|-------|---------|
| `meta.count` | Results on this page |
| `meta.total` | Total matching announcements (`SearchResultCountAll`) |
| `results[].id` | Control number, the handle for `detail` |
| `results[].title` / `.company` / `.location` / `.date` / `.url` | Standard fields; `company` is the hiring agency |
| `results[].salaryMin` / `.salaryMax` | Published pay range in USD |
| `results[].closes` | Application deadline, the field that actually governs urgency |

Errors go to **stderr** as `{"error": "...", "code": "..."}` with exit code 1.

## Notes

- **Salary filtering is bucketed, not exact.** USAJOBS sorts postings into 25k
  bands ($125,000-$149,999, $150,000-$174,999, and so on). A `--minsalary 140000`
  returns the whole $125k-$149,999 band, so some results sit below your floor.
  Filter precisely on the returned `salaryMin` rather than trusting the flag.
- **Results are limited to announcements open to the public.** The CLI pins
  `WhoMayApply=public`; the `All` and `Status` scopes require separate
  authorization from OPM and are mostly relevant to current federal employees.
- **`--jobage` caps at 60 days**, which is the API's documented ceiling, and the
  CLI rejects larger values before making a request.
- **Announcements expire.** A closed posting leaves the Search API entirely, so
  `detail` on an old control number returns `NOT_FOUND`. Federal openings often
  close in 5-14 days, so `closes` matters more here than on commercial boards.
- There is no lookup-by-id endpoint in the Search API, so `detail` searches the
  control number as a keyword and matches the id exactly.
- Federal hiring is slower than commercial hiring; treat this portal as a parallel
  track rather than a fast one.

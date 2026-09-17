#!/usr/bin/env bun
import { writeError } from "./helpers.ts"
import { search, type SearchOptions } from "./commands/search.ts"
import { detail } from "./commands/detail.ts"

const HELP = `usajobs-cli — search the official USAJOBS API (U.S. federal jobs)

SETUP (required)
  USAJOBS needs a free API key. Request one at:
    https://developer.usajobs.gov/APIRequest
  Then export both values (add them to ~/.claude/.env or your shell profile):
    export USAJOBS_EMAIL="the address you registered"
    export USAJOBS_API_TOKEN="the key they email you"

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [flags]
  bun run src/cli.ts detail <control number> | <usajobs.gov url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keyword search across the whole announcement.
  --title, -t <text>      Match the job title only ("contains").
  --location, -l <text>   City/installation, e.g. "Boca Raton, Florida".
                          Semicolon-delimited for multiple.
  --organization <code>   Agency subelement code, e.g. TR for Treasury.
  --minsalary <usd>       Minimum salary. USAJOBS buckets these in 25k bands.
  --remote                Only remote-eligible announcements.
  --jobage <days>         Posted within N days. 0-60 (the API's ceiling).
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Results per page, up to 500. Default 25.
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "program manager" --minsalary 140000 --format table
  bun run src/cli.ts search -t "Program Manager" -l "Boca Raton, Florida" --format table
  bun run src/cli.ts search -q "systems engineer" --remote --jobage 14 --format table
  bun run src/cli.ts detail 21947200 --format plain

Results are limited to announcements open to the public (WhoMayApply=public);
"All" and "Status" require separate authorization from OPM.`

function fail(message: string, code: string): never {
  writeError(message, code)
  process.exit(1)
}

function parseArgs(argv: string[]): SearchOptions {
  const opts: SearchOptions = {
    query: null, title: null, location: null, organization: null,
    jobage: null, minSalary: null, remote: false,
    page: 1, limit: 25, format: "json",
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const next = () => {
      const v = argv[++i]
      if (v === undefined) fail(`Flag ${arg} requires a value.`, "MISSING_VALUE")
      return v
    }
    const positiveInt = (label: string, max?: number) => {
      const v = Number(next())
      if (!Number.isInteger(v) || v < 1 || (max !== undefined && v > max)) {
        fail(`${label} must be an integer${max ? ` between 1 and ${max}` : " greater than 0"}.`, "BAD_FLAG")
      }
      return v
    }
    switch (arg) {
      case "--query": case "-q": opts.query = next(); break
      case "--title": case "-t": opts.title = next(); break
      case "--location": case "-l": opts.location = next(); break
      case "--organization": opts.organization = next(); break
      case "--remote": opts.remote = true; break
      case "--minsalary": {
        const v = Number(next())
        if (!Number.isFinite(v) || v < 0) fail("--minsalary must be a non-negative number.", "BAD_FLAG")
        opts.minSalary = v
        break
      }
      case "--jobage": {
        const v = Number(next())
        if (!Number.isInteger(v) || v < 0 || v > 60) {
          fail("--jobage must be an integer between 0 and 60 (the USAJOBS ceiling).", "BAD_FLAG")
        }
        opts.jobage = v
        break
      }
      case "--page": opts.page = positiveInt("--page"); break
      case "--limit": case "-n": opts.limit = positiveInt("--limit", 500); break
      case "--format": {
        const v = next()
        if (v !== "json" && v !== "table" && v !== "plain") {
          fail("--format must be one of: json, table, plain.", "BAD_FLAG")
        }
        opts.format = v
        break
      }
      default: fail(`Unknown flag: ${arg}`, "BAD_FLAG")
    }
  }
  return opts
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP)
    process.exit(0)
  }

  const [command, ...rest] = argv
  try {
    if (command === "search") {
      console.log(await search(parseArgs(rest)))
      return
    }
    if (command === "detail") {
      const ref = rest[0]
      if (!ref || ref.startsWith("-")) fail("detail requires a control number or URL.", "MISSING_ARG")
      let format: "json" | "plain" = "json"
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] === "--format") {
          const v = rest[++i]
          if (v !== "json" && v !== "plain") fail("--format must be json or plain.", "BAD_FLAG")
          format = v
        } else fail(`Unknown flag: ${rest[i]}`, "BAD_FLAG")
      }
      console.log(await detail(ref, format))
      return
    }
    fail(`Unknown command: ${command}. Expected "search" or "detail".`, "BAD_COMMAND")
  } catch (err) {
    const e = err as Error & { code?: string }
    fail(e.message ?? String(err), e.code ?? "REQUEST_FAILED")
  }
}

main()

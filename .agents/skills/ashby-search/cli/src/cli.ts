#!/usr/bin/env bun
import { writeError } from "./helpers.ts"
import { search, type SearchOptions } from "./commands/search.ts"
import { detail } from "./commands/detail.ts"

const HELP = `ashby-cli — search Ashby public job boards (ashby.: one board per company slug)

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [--company <slug>[,<slug>]] [flags]
  bun run src/cli.ts detail <company>:<id> | <board url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>     Keyword filter on title + company (all terms must match).
  --company, -c <slugs>  Comma-separated Ashby board slugs. Repeatable.
                         Defaults to the slugs in the skill's companies.txt.
  --location, -l <text>  Substring filter on the posting's location.
  --jobage <days>        Only postings published within N days.
  --page <n>             1-indexed page. Default 1.
  --limit, -n <n>        Results per page. Default 25.
  --format <fmt>         json (default) | table | plain.

DETAIL
  <company>:<id>         The composite id from a search result.
  <board url>            A Ashby posting URL.

EXAMPLES
  bun run src/cli.ts search -q "program manager" --limit 10 --format table
  bun run src/cli.ts search -q "solutions architect" -c ramp --jobage 30 --format table
  bun run src/cli.ts search -l "Florida" --format table
  bun run src/cli.ts detail ramp:12345 --format plain

No authentication and zero runtime dependencies. Filtering is client-side: the
API serves a whole board per request, so keep the company list to what you
actually target.`

function fail(message: string, code: string): never {
  writeError(message, code)
  process.exit(1)
}

function parseArgs(argv: string[]): SearchOptions {
  const opts: SearchOptions = {
    query: null, location: null, companies: [],
    jobage: null, page: 1, limit: 25, format: "json",
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const next = () => {
      const v = argv[++i]
      if (v === undefined) fail(`Flag ${arg} requires a value.`, "MISSING_VALUE")
      return v
    }
    switch (arg) {
      case "--query": case "-q": opts.query = next(); break
      case "--location": case "-l": opts.location = next(); break
      case "--company": case "-c":
        opts.companies.push(...next().split(",").map((s) => s.trim()).filter(Boolean))
        break
      case "--jobage": {
        const v = Number(next())
        if (!Number.isInteger(v) || v < 1) fail("--jobage must be a positive integer.", "BAD_FLAG")
        opts.jobage = v
        break
      }
      case "--page": {
        const v = Number(next())
        if (!Number.isInteger(v) || v < 1) fail("--page must be a positive integer.", "BAD_FLAG")
        opts.page = v
        break
      }
      case "--limit": case "-n": {
        const v = Number(next())
        if (!Number.isInteger(v) || v < 1) fail("--limit must be a positive integer.", "BAD_FLAG")
        opts.limit = v
        break
      }
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
      if (!ref || ref.startsWith("-")) fail("detail requires a <company>:<id> or URL.", "MISSING_ARG")
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

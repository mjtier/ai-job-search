import {
  extractPostings, jsonFetch, listUrl, loadCompanies, normalize,
  renderPlain, renderTable, type JobCard,
} from "../helpers.ts"

export interface SearchOptions {
  query: string | null
  location: string | null
  companies: string[]
  jobage: number | null
  page: number
  limit: number
  format: "json" | "table" | "plain"
}

function matches(card: JobCard, opts: SearchOptions): boolean {
  if (opts.query) {
    const needle = opts.query.toLowerCase()
    const terms = needle.split(/\s+/).filter(Boolean)
    const hay = `${card.title ?? ""} ${card.company ?? ""}`.toLowerCase()
    if (!terms.every((t) => hay.includes(t))) return false
  }
  if (opts.location) {
    const loc = (card.location ?? "").toLowerCase()
    if (!loc.includes(opts.location.toLowerCase())) return false
  }
  if (opts.jobage !== null && card.date) {
    const cutoff = Date.now() - opts.jobage * 86400000
    const posted = Date.parse(card.date)
    if (Number.isFinite(posted) && posted < cutoff) return false
  }
  return true
}

export async function search(opts: SearchOptions): Promise<string> {
  const companies = opts.companies.length > 0 ? opts.companies : await loadCompanies()
  if (companies.length === 0) {
    throw Object.assign(
      new Error(
        "No company slugs to search. Pass --company <slug>[,<slug>] or add slugs to the skill's companies.txt."
      ),
      { code: "NO_COMPANIES" }
    )
  }

  const collected: JobCard[] = []
  const failed: string[] = []
  for (const company of companies) {
    let payload: unknown | null
    try {
      payload = await jsonFetch(listUrl(company))
    } catch {
      failed.push(company)
      continue
    }
    if (payload === null) {
      failed.push(company)
      continue
    }
    for (const raw of extractPostings(payload)) {
      const card = normalize(company, raw)
      if (card.title && matches(card, opts)) collected.push(card)
    }
  }

  collected.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  const start = (opts.page - 1) * opts.limit
  const results = collected.slice(start, start + opts.limit)

  if (opts.format === "table") return renderTable(results)
  if (opts.format === "plain") return renderPlain(results)
  return JSON.stringify(
    {
      meta: {
        count: results.length,
        page: opts.page,
        total: collected.length,
        companies_searched: companies.length,
        companies_unavailable: failed,
      },
      results,
    },
    null,
    2
  )
}

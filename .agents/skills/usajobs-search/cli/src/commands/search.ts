import {
  SEARCH_URL, apiFetch, extractItems, loadCredentials, normalize,
  renderPlain, renderTable, totalCount, type JobCard,
} from "../helpers.ts"

export interface SearchOptions {
  query: string | null
  title: string | null
  location: string | null
  organization: string | null
  jobage: number | null
  minSalary: number | null
  remote: boolean
  page: number
  limit: number
  format: "json" | "table" | "plain"
}

export function buildUrl(opts: SearchOptions): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("Keyword", opts.query)
  if (opts.title) params.set("PositionTitle", opts.title)
  if (opts.location) params.set("LocationName", opts.location)
  if (opts.organization) params.set("Organization", opts.organization)
  if (opts.jobage !== null) params.set("DatePosted", String(opts.jobage))
  if (opts.minSalary !== null) params.set("RemunerationMinimumAmount", String(opts.minSalary))
  if (opts.remote) params.set("RemoteIndicator", "True")
  params.set("Page", String(opts.page))
  params.set("ResultsPerPage", String(opts.limit))
  params.set("WhoMayApply", "public")
  params.set("SortField", "opendate")
  params.set("SortDirection", "desc")
  params.set("Fields", "full")
  return `${SEARCH_URL}?${params.toString()}`
}

export async function search(opts: SearchOptions): Promise<string> {
  const creds = loadCredentials()
  const payload = await apiFetch(buildUrl(opts), creds)
  const results: JobCard[] = extractItems(payload).map(normalize)

  if (opts.format === "table") return renderTable(results)
  if (opts.format === "plain") return renderPlain(results)
  return JSON.stringify(
    {
      meta: { count: results.length, page: opts.page, total: totalCount(payload) },
      results,
    },
    null,
    2
  )
}

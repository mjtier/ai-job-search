// Data source: the official USAJOBS Search API (data.usajobs.gov), operated by
// the U.S. Office of Personnel Management. Requires a free API key.
//
// Auth is two headers, verified live: a request with no headers returns 403, and
// one carrying both headers with a bad key returns a clean 401 JSON body.

export const SEARCH_URL = "https://data.usajobs.gov/api/search"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export interface Credentials {
  token: string
  email: string
}

/**
 * Read credentials from the environment. Never accepted as CLI flags: flags leak
 * into shell history and process listings.
 */
export function loadCredentials(): Credentials {
  const token = process.env.USAJOBS_API_TOKEN?.trim()
  const email = process.env.USAJOBS_EMAIL?.trim()
  if (!token || !email) {
    const missing = [
      !token ? "USAJOBS_API_TOKEN" : null,
      !email ? "USAJOBS_EMAIL" : null,
    ].filter(Boolean).join(" and ")
    throw Object.assign(
      new Error(
        `Missing ${missing}. Request a free key at https://developer.usajobs.gov/APIRequest ` +
          `and export both values (USAJOBS_EMAIL must be the address you registered).`
      ),
      { code: "MISSING_CREDENTIALS" }
    )
  }
  return { token, email }
}

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function apiFetch(url: string, creds: Credentials): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        Host: "data.usajobs.gov",
        "User-Agent": creds.email,
        "Authorization-Key": creds.token,
        Accept: "application/json",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (response.status === 401 || response.status === 403) {
      throw Object.assign(
        new Error(
          "USAJOBS rejected the credentials. Check USAJOBS_API_TOKEN and that " +
            "USAJOBS_EMAIL matches the address the key was issued to."
        ),
        { code: "AUTH_REJECTED" }
      )
    }
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string | null
  company: string | null
  location: string | null
  date: string | null
  url: string | null
  salaryMin: number | null
  salaryMax: number | null
  closes: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  department: string | null
  qualifications: string | null
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Pull the result array out of a Search response envelope. */
export function extractItems(payload: unknown): any[] {
  const items = (payload as any)?.SearchResult?.SearchResultItems
  return Array.isArray(items) ? items : []
}

export function totalCount(payload: unknown): number {
  const n = Number((payload as any)?.SearchResult?.SearchResultCountAll)
  return Number.isFinite(n) ? n : 0
}

function money(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Map one SearchResultItem to the shared JobCard shape. */
export function normalize(item: any): JobCard {
  const d = item?.MatchedObjectDescriptor ?? {}
  const pay = Array.isArray(d.PositionRemuneration) ? d.PositionRemuneration[0] : null
  const start: string | null = d.PublicationStartDate ?? null
  const close: string | null = d.ApplicationCloseDate ?? null
  return {
    id: String(item?.MatchedObjectId ?? ""),
    title: typeof d.PositionTitle === "string" ? d.PositionTitle.trim() : null,
    company: d.OrganizationName ?? d.DepartmentName ?? null,
    location: d.PositionLocationDisplay ?? null,
    date: start ? start.slice(0, 10) : null,
    url: d.PositionURI ?? null,
    salaryMin: money(pay?.MinimumRange),
    salaryMax: money(pay?.MaximumRange),
    closes: close ? close.slice(0, 10) : null,
  }
}

/** Detail fields, present when the request used Fields=Full. */
export function describe(item: any): Omit<JobDetail, keyof JobCard> {
  const d = item?.MatchedObjectDescriptor ?? {}
  const details = d?.UserArea?.Details ?? {}
  const schedule = Array.isArray(d.PositionSchedule) ? d.PositionSchedule[0]?.Name : null
  const summary = [details.JobSummary, details.MajorDuties]
    .flat()
    .filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
    .map(stripHtml)
    .join("\n\n")
  return {
    description: summary.trim() || null,
    employmentType: schedule ?? null,
    department: d.DepartmentName ?? null,
    qualifications: typeof details.Requirements === "string"
      ? stripHtml(details.Requirements) || null
      : null,
  }
}

function fmtMoney(n: number | null): string {
  return n === null ? "-" : `$${Math.round(n).toLocaleString("en-US")}`
}

export function renderTable(rows: JobCard[]): string {
  if (rows.length === 0) return "No results."
  const cols: Array<[string, (r: JobCard) => string]> = [
    ["ID", (r) => r.id],
    ["TITLE", (r) => r.title ?? ""],
    ["AGENCY", (r) => r.company ?? ""],
    ["LOCATION", (r) => r.location ?? ""],
    ["SALARY", (r) => `${fmtMoney(r.salaryMin)}-${fmtMoney(r.salaryMax)}`],
    ["CLOSES", (r) => r.closes ?? ""],
  ]
  const widths = cols.map(([head, get]) =>
    Math.min(40, Math.max(head.length, ...rows.map((r) => get(r).length)))
  )
  const line = (cells: string[]) =>
    cells.map((c, i) => c.slice(0, widths[i]!).padEnd(widths[i]!)).join("  ").trimEnd()
  return [
    line(cols.map(([h]) => h)),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map((r) => line(cols.map(([, get]) => get(r)))),
  ].join("\n")
}

export function renderPlain(rows: JobCard[]): string {
  if (rows.length === 0) return "No results."
  return rows
    .map((r) =>
      [
        r.title ?? "(untitled)",
        `  agency:   ${r.company ?? "-"}`,
        `  location: ${r.location ?? "-"}`,
        `  salary:   ${fmtMoney(r.salaryMin)} - ${fmtMoney(r.salaryMax)}`,
        `  posted:   ${r.date ?? "-"}`,
        `  closes:   ${r.closes ?? "-"}`,
        `  id:       ${r.id}`,
        `  url:      ${r.url ?? "-"}`,
      ].join("\n")
    )
    .join("\n\n")
}

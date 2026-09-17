// Data source: Lever's public job-board API. No authentication required.
// Each company exposes its own board under a slug; this CLI fans out across a
// configured slug list and filters client-side. Verified live against api.lever.co.

export const PROVIDER = "lever"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; lever-search-cli/1.0)"

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch(url: string): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
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
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  department: string | null
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** The board URL for one company slug. */
export function listUrl(company: string): string {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`
}

/** Pull the array of raw postings out of a board payload. */
export function extractPostings(payload: unknown): unknown[] {
  const list = Array.isArray(payload) ? payload : []
  return Array.isArray(list) ? list : []
}

/** Map one raw posting to the shared JobCard shape. */
export function normalize(company: string, raw: any): JobCard {
  const loc = raw?.categories?.location ?? null
  const created = Number(raw?.createdAt)
  return {
    id: `${company}:${raw?.id}`,
    title: typeof raw?.text === "string" ? raw.text.trim() : null,
    company,
    location: typeof loc === "string" && loc.trim() ? loc.trim() : null,
    date: Number.isFinite(created) ? new Date(created).toISOString().slice(0, 10) : null,
    url: raw?.hostedUrl ?? raw?.applyUrl ?? null,
  }
}

/** Provider-specific detail fields for one raw posting. */
export function describe(raw: any): Omit<JobDetail, keyof JobCard> {
  // Lever splits the body across several *Plain fields; concatenate in reading order.
  const parts = [raw?.descriptionPlain, raw?.descriptionBodyPlain, raw?.additionalPlain]
    .filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
  return {
    description: parts.join("\n\n").trim() || null,
    employmentType: raw?.categories?.commitment ?? null,
    department: raw?.categories?.team ?? raw?.categories?.department ?? null,
  }
}

/** Split a composite `<company>:<nativeId>` id, or parse a board URL. */
export function splitId(value: string): { company: string; id: string } | null {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = parseBoardUrl(trimmed)
    if (parsed) return parsed
  }
  const at = trimmed.indexOf(":")
  if (at <= 0 || at === trimmed.length - 1) return null
  return { company: trimmed.slice(0, at), id: trimmed.slice(at + 1) }
}

function parseBoardUrl(url: string): { company: string; id: string } | null {
  try {
    const u = new URL(url)
    const segs = u.pathname.split("/").filter(Boolean)
    const gh = u.searchParams.get("gh_jid")
    if (gh && segs.length >= 1) return { company: segs[0]!, id: gh }
    if (segs.length >= 2) return { company: segs[segs.length - 2]!, id: segs[segs.length - 1]! }
    return null
  } catch {
    return null
  }
}

/**
 * Company slugs to search when --company is omitted: the skill's companies.txt,
 * one slug per line, `#` comments and blanks ignored.
 */
export async function loadCompanies(): Promise<string[]> {
  const path = new URL("../../companies.txt", import.meta.url).pathname
  try {
    const text = await Bun.file(path).text()
    return text
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter((line) => line.length > 0)
  } catch {
    return []
  }
}

export function renderTable(rows: JobCard[]): string {
  if (rows.length === 0) return "No results."
  const cols: Array<[string, (r: JobCard) => string]> = [
    ["ID", (r) => r.id],
    ["TITLE", (r) => r.title ?? ""],
    ["COMPANY", (r) => r.company ?? ""],
    ["LOCATION", (r) => r.location ?? ""],
    ["DATE", (r) => r.date ?? ""],
  ]
  const widths = cols.map(([head, get]) =>
    Math.min(46, Math.max(head.length, ...rows.map((r) => get(r).length)))
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
        `  company:  ${r.company ?? "-"}`,
        `  location: ${r.location ?? "-"}`,
        `  date:     ${r.date ?? "-"}`,
        `  id:       ${r.id}`,
        `  url:      ${r.url ?? "-"}`,
      ].join("\n")
    )
    .join("\n\n")
}

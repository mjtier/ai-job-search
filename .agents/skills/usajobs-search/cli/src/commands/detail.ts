import {
  SEARCH_URL, apiFetch, describe, extractItems, loadCredentials, normalize,
  type JobDetail,
} from "../helpers.ts"

/** Accept a bare control number or a usajobs.gov job URL. */
export function parseRef(ref: string): string | null {
  const trimmed = ref.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  const match = trimmed.match(/(?:ViewDetails\/|usajobs\.gov\/job\/)(\d+)/i)
  return match ? match[1]! : null
}

export async function detail(ref: string, format: "json" | "plain"): Promise<string> {
  const id = parseRef(ref)
  if (!id) {
    throw Object.assign(
      new Error(`Could not parse "${ref}". Expected a control number or a usajobs.gov job URL.`),
      { code: "BAD_ID" }
    )
  }

  // The Search API has no lookup-by-id endpoint; the control number is indexed as
  // a keyword, so we search for it and match the id exactly.
  const creds = loadCredentials()
  const url = `${SEARCH_URL}?Keyword=${encodeURIComponent(id)}&Fields=full&ResultsPerPage=25`
  const payload = await apiFetch(url, creds)
  const item = extractItems(payload).find((i: any) => String(i?.MatchedObjectId) === id)
  if (!item) {
    throw Object.assign(
      new Error(
        `Posting ${id} not found. It may have closed; announcements leave the ` +
          `Search API when they expire. Try https://www.usajobs.gov/job/${id}`
      ),
      { code: "NOT_FOUND" }
    )
  }

  const job: JobDetail = { ...normalize(item), ...describe(item) }
  if (format === "json") return JSON.stringify(job, null, 2)
  const money = (n: number | null) => (n === null ? "-" : `$${Math.round(n).toLocaleString("en-US")}`)
  return [
    job.title ?? "(untitled)",
    `agency:   ${job.company ?? "-"}`,
    `dept:     ${job.department ?? "-"}`,
    `location: ${job.location ?? "-"}`,
    `salary:   ${money(job.salaryMin)} - ${money(job.salaryMax)}`,
    `type:     ${job.employmentType ?? "-"}`,
    `posted:   ${job.date ?? "-"}`,
    `closes:   ${job.closes ?? "-"}`,
    `url:      ${job.url ?? "-"}`,
    "",
    job.description ?? "(no description)",
    job.qualifications ? `\n--- Qualifications ---\n${job.qualifications}` : "",
  ].join("\n").trimEnd()
}

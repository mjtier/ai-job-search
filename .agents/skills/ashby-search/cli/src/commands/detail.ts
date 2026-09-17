import {
  describe, extractPostings, jsonFetch, listUrl, normalize, splitId,
  type JobDetail,
} from "../helpers.ts"

export async function detail(ref: string, format: "json" | "plain"): Promise<string> {
  const parts = splitId(ref)
  if (!parts) {
    throw Object.assign(
      new Error(`Could not parse "${ref}". Expected <company>:<id> or a board URL.`),
      { code: "BAD_ID" }
    )
  }

  // The board payload already carries the full description, so one fetch is enough.
  const board = await jsonFetch(listUrl(parts.company))
  const raw =
    board === null
      ? null
      : extractPostings(board).find((p: any) => String(p?.id) === parts.id) ?? null
  if (raw === null) {
    throw Object.assign(new Error(`Posting not found: ${ref}`), { code: "NOT_FOUND" })
  }

  const job: JobDetail = { ...normalize(parts.company, raw), ...describe(raw) }
  if (format === "json") return JSON.stringify(job, null, 2)
  return [
    job.title ?? "(untitled)",
    `company:  ${job.company ?? "-"}`,
    `location: ${job.location ?? "-"}`,
    `date:     ${job.date ?? "-"}`,
    `type:     ${job.employmentType ?? "-"}`,
    `team:     ${job.department ?? "-"}`,
    `url:      ${job.url ?? "-"}`,
    "",
    job.description ?? "(no description)",
  ].join("\n")
}

import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.ts"
import { buildUrl } from "../src/commands/search.ts"
import { parseRef } from "../src/commands/detail.ts"
import { normalize } from "../src/helpers.ts"

const hasKey = Boolean(process.env.USAJOBS_API_TOKEN && process.env.USAJOBS_EMAIL)

interface SearchResponse {
  meta: { count: number; page: number; total: number }
  results: Array<{ id: string; title: string | null; url: string | null; salaryMin: number | null }>
}

describe("usajobs-search: offline contract", () => {
  test("missing credentials fail loudly rather than sending an unauthenticated request", async () => {
    const result = await runCLI(["search", "-q", "engineer"])
    if (hasKey) return // credentials present; covered by the live suite below
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("MISSING_CREDENTIALS")
    expect(err.error).toContain("USAJOBS_API_TOKEN")
  })

  test("buildUrl maps flags onto the documented query parameters", () => {
    const url = new URL(
      buildUrl({
        query: "program manager", title: null, location: "Boca Raton, Florida",
        organization: null, jobage: 14, minSalary: 140000, remote: false,
        page: 2, limit: 50, format: "json",
      })
    )
    expect(url.searchParams.get("Keyword")).toBe("program manager")
    expect(url.searchParams.get("LocationName")).toBe("Boca Raton, Florida")
    expect(url.searchParams.get("DatePosted")).toBe("14")
    expect(url.searchParams.get("RemunerationMinimumAmount")).toBe("140000")
    expect(url.searchParams.get("Page")).toBe("2")
    expect(url.searchParams.get("ResultsPerPage")).toBe("50")
    expect(url.searchParams.get("WhoMayApply")).toBe("public")
  })

  test("parseRef accepts a control number and a job URL, rejects junk", () => {
    expect(parseRef("21947200")).toBe("21947200")
    expect(parseRef("https://www.usajobs.gov/GetJob/ViewDetails/21947200")).toBe("21947200")
    expect(parseRef("https://www.usajobs.gov/job/21947200")).toBe("21947200")
    expect(parseRef("not-an-id")).toBeNull()
  })

  test("normalize maps a SearchResultItem onto the shared job shape", () => {
    const card = normalize({
      MatchedObjectId: "21947200",
      MatchedObjectDescriptor: {
        PositionTitle: " IT Specialist ",
        OrganizationName: "Space and Naval Warfare Systems Command",
        PositionLocationDisplay: "San Diego, California",
        PositionURI: "https://www.usajobs.gov/GetJob/ViewDetails/21947200",
        PublicationStartDate: "2026-09-01T00:00:00.0000",
        ApplicationCloseDate: "2026-09-30T00:00:00.0000",
        PositionRemuneration: [{ MinimumRange: "142000", MaximumRange: "180000" }],
      },
    })
    expect(card.id).toBe("21947200")
    expect(card.title).toBe("IT Specialist")
    expect(card.date).toBe("2026-09-01")
    expect(card.closes).toBe("2026-09-30")
    expect(card.salaryMin).toBe(142000)
  })

  test("a bogus flag exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--nope"])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(JSON.parse(result.stderr).code).toBe("BAD_FLAG")
  })

  test("--jobage above the API ceiling is rejected before any request", async () => {
    const result = await runCLI(["search", "--jobage", "90"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("BAD_FLAG")
  })

  test("detail without an argument exits 1", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("MISSING_ARG")
  })
})

// These run only once USAJOBS_API_TOKEN and USAJOBS_EMAIL are set.
describe.if(hasKey)("usajobs-search: live", () => {
  test("search returns real, complete results", async () => {
    const result = await runCLI(["search", "-q", "program manager", "-n", "5"])
    expect(result.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(result)
    expect(data.results.length).toBeGreaterThan(0)
    for (const job of data.results) {
      expect(job.id).toMatch(/^\d+$/)
      expect(job.title).toBeTruthy()
      expect(job.url).toMatch(/^https?:\/\//)
    }
  })

  test("detail returns readable text for a real posting", async () => {
    const list = parseJSON<SearchResponse>(await runCLI(["search", "-n", "1"]))
    const result = await runCLI(["detail", list.results[0]!.id, "--format", "plain"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(80)
    expect(result.stdout).not.toContain("<div")
  })
})

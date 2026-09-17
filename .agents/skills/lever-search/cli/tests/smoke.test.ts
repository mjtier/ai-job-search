import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.ts"

interface SearchResponse {
  meta: { count: number; page: number; total: number }
  results: Array<{ id: string; title: string | null; company: string | null; url: string | null }>
}

describe("lever-search CLI", () => {
  test("search returns real, complete results", async () => {
    const result = await runCLI(["search", "-q", "manager", "-c", "palantir", "-n", "5"])
    expect(result.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(result)
    expect(data.results.length).toBeGreaterThan(0)
    for (const job of data.results) {
      expect(job.id).toContain(":")
      expect(job.title).toBeTruthy()
      expect(job.url).toMatch(/^https?:\/\//)
    }
  })

  test("detail returns readable text for a real posting", async () => {
    const list = parseJSON<SearchResponse>(
      await runCLI(["search", "-c", "palantir", "-n", "1"])
    )
    const id = list.results[0]!.id
    const result = await runCLI(["detail", id, "--format", "plain"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(80)
    expect(result.stdout).not.toContain("<div")
  })

  test("a bogus flag exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--nope"])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(JSON.parse(result.stderr).code).toBe("BAD_FLAG")
  })

  test("detail without an argument exits 1", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("MISSING_ARG")
  })
})

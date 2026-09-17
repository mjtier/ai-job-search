# USAJOBS Search API reference

The endpoints, parameters, and response shapes this skill depends on. This is the
file to update if USAJOBS changes its API.
Official docs: <https://developer.usajobs.gov/api-reference/get-api-search>

## Authentication

Required. A free key is issued at <https://developer.usajobs.gov/APIRequest>.

Three headers, verified empirically against the live API:

| Header | Value |
|--------|-------|
| `Host` | `data.usajobs.gov` |
| `User-Agent` | the email address the key was registered to |
| `Authorization-Key` | the API key |

Observed behaviour:

| Request | Status |
|---------|--------|
| No headers | `403` (HTML access-denied page) |
| Both headers, invalid key | `401` with a JSON problem document |
| `GET /api/codelist/agencysubelements` (no key) | `200`, public |

Credentials are read **only** from `USAJOBS_API_TOKEN` and `USAJOBS_EMAIL`, never
from CLI flags, and never written to this repo.

## Endpoints

| Purpose | Request |
|---------|---------|
| Search | `GET https://data.usajobs.gov/api/search?<params>` |
| One posting | No lookup-by-id endpoint exists. `detail` issues `?Keyword=<controlNumber>&Fields=full` and matches `MatchedObjectId` exactly. |
| Code lists (agencies, occupational series) | `GET https://data.usajobs.gov/api/codelist/agencysubelements` — public, no key |

## Query parameters used

| Our flag | USAJOBS parameter | Notes |
|----------|-------------------|-------|
| `--query` | `Keyword` | Searches the whole announcement, including synonyms |
| `--title` | `PositionTitle` | "Contains" match on the title |
| `--location` | `LocationName` | City or installation; semicolon-delimited for multiple |
| `--organization` | `Organization` | Agency subelement code |
| `--minsalary` | `RemunerationMinimumAmount` | **Bucketed into 25k bands**, not an exact floor |
| `--remote` | `RemoteIndicator` | `True` |
| `--jobage` | `DatePosted` | Integer 0-60; the API rejects larger values |
| `--page` | `Page` | 1-indexed |
| `--limit` | `ResultsPerPage` | Up to 500 |
| (always) | `WhoMayApply=public` | `All` and `Status` need separate OPM authorization |
| (always) | `Fields=full` | Without it the response omits the description body |
| (always) | `SortField=opendate&SortDirection=desc` | Newest first |

## Response fields used

The envelope is `LanguageCode` / `SearchParameters` / `SearchResult`, where
`SearchResult.SearchResultItems[]` holds the postings.

| Our field | USAJOBS source |
|-----------|----------------|
| `id` | `MatchedObjectId` (the control number) |
| `title` | `MatchedObjectDescriptor.PositionTitle` |
| `company` | `OrganizationName`, falling back to `DepartmentName` |
| `location` | `PositionLocationDisplay` |
| `date` | `PublicationStartDate` |
| `closes` | `ApplicationCloseDate` |
| `url` | `PositionURI` |
| `salaryMin` / `salaryMax` | `PositionRemuneration[0].MinimumRange` / `.MaximumRange` |
| `description` | `UserArea.Details.JobSummary` + `MajorDuties`, HTML stripped |
| `qualifications` | `UserArea.Details.Requirements`, HTML stripped |
| `employmentType` | `PositionSchedule[0].Name` |
| `meta.total` | `SearchResult.SearchResultCountAll` |

## Notes

- `Fields=full` is required for `UserArea.Details`; the default `Min` response
  carries only the summary.
- Salary bucketing is a property of the API, not this client: the documented bands
  are $0-24,999, $25,000-49,999, $50,000-74,999, $75,000-99,999, $100,000-124,999,
  $125,000-149,999, $150,000-174,999, $175,000-199,999, and $200,000+.
- Closed announcements are removed from the Search API, so `detail` on an expired
  control number legitimately returns `NOT_FOUND`.

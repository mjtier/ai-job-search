# Ashby job board API reference

The endpoints, parameters, and response shapes this skill depends on. This is the
file to update if Ashby changes its API.

## Authentication

None. All endpoints below are public and were verified live returning HTTP 200.

## Endpoints

| Purpose | Request |
|---------|---------|
| List a company's board | `GET https://api.ashbyhq.com/posting-api/job-board/{slug}` |
| One posting | served by the list payload; no second endpoint needed |

## Response fields used

| Our field | Ashby source |
|-----------|------------|
| `id` | `id` (prefixed with the slug) |
| `title` | `title`, trimmed |
| `company` | the slug (no company field in the payload) |
| `location` | `location` |
| `date` | `publishedAt` |
| `url` | `jobUrl`, falling back to `applyUrl` |
| `description` | `descriptionPlain`, already plain text in the list payload |
| `employmentType` | `employmentType` |

## Notes

- Ashby serves one board per company slug (the segment in `jobs.ashbyhq.com/<slug>`). The list response already carries `descriptionPlain`, so `detail` reuses the board payload instead of calling a second endpoint. Titles sometimes carry a leading space, trimmed here.
- The composite id this CLI emits is `<company-slug>:<native-id>`, so a posting is
  addressable without carrying the board context separately.

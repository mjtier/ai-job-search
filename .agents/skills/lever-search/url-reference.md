# Lever job board API reference

The endpoints, parameters, and response shapes this skill depends on. This is the
file to update if Lever changes its API.

## Authentication

None. All endpoints below are public and were verified live returning HTTP 200.

## Endpoints

| Purpose | Request |
|---------|---------|
| List a company's board | `GET https://api.lever.co/v0/postings/{slug}?mode=json` |
| One posting | `GET https://api.lever.co/v0/postings/{slug}/{id}?mode=json` |

## Response fields used

| Our field | Lever source |
|-----------|------------|
| `id` | `id` (prefixed with the slug) |
| `title` | `text` |
| `company` | the slug (no company field in the payload) |
| `location` | `categories.location` |
| `date` | `createdAt`, epoch milliseconds |
| `url` | `hostedUrl`, falling back to `applyUrl` |
| `description` | `descriptionPlain` + `descriptionBodyPlain` + `additionalPlain` |
| `employmentType` | `categories.commitment` |

## Notes

- Lever serves one board per company slug (the segment in `jobs.lever.co/<slug>`). `createdAt` is epoch milliseconds, converted to an ISO date here. Not every company on Lever exposes the v0 API; a 404 yields zero results for that slug rather than an error.
- The composite id this CLI emits is `<company-slug>:<native-id>`, so a posting is
  addressable without carrying the board context separately.

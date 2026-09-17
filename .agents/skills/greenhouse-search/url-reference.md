# Greenhouse job board API reference

The endpoints, parameters, and response shapes this skill depends on. This is the
file to update if Greenhouse changes its API.

## Authentication

None. All endpoints below are public and were verified live returning HTTP 200.

## Endpoints

| Purpose | Request |
|---------|---------|
| List a company's board | `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
| One posting | `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{id}` |

## Response fields used

| Our field | Greenhouse source |
|-----------|------------|
| `id` | `id` (prefixed with the slug) |
| `title` | `title` |
| `company` | `company_name` |
| `location` | `location.name` |
| `date` | `first_published`, falling back to `updated_at` |
| `url` | `absolute_url` |
| `description` | `content` on the detail endpoint, HTML entity-encoded twice |
| `department` | `departments[0].name` |

## Notes

- Greenhouse serves one board per company slug. The slug is the segment in `boards.greenhouse.io/<slug>` or `job-boards.greenhouse.io/<slug>`. No authentication, no rate limit published; keep volume low anyway.
- The composite id this CLI emits is `<company-slug>:<native-id>`, so a posting is
  addressable without carrying the board context separately.

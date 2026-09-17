# usajobs-cli

CLI for the `usajobs-search` skill. See `../SKILL.md` for usage and setup, and
`../url-reference.md` for the API contract.

Requires `USAJOBS_API_TOKEN` and `USAJOBS_EMAIL` in the environment. The live
tests skip automatically when they are unset.

```bash
bun install      # dev types only; zero runtime dependencies
bun run typecheck
bun run test
```

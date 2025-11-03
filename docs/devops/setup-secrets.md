# Secrets to configure (GitHub → Settings → Secrets and variables → Actions)

## Required
- `CF_API_TOKEN` – Cloudflare API token with Workers KV + D1 + Pages Deploy
- `CF_ACCOUNT_ID` – Cloudflare account id
- `CF_PAGES_PROJECT` – Pages project name (e.g., `researchops-ui`)

## App secrets
- `AIRTABLE_API_KEY` – PAT with read/write to your base
- `AIRTABLE_BASE_ID` – Airtable base id
- `MURAL_API_TOKEN` – Mural API token (journal sync)
- `GITHUB_TOKEN` – Provided by GitHub Actions by default

> Keep `.env` local only. Never commit secrets.

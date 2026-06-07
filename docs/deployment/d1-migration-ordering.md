# D1 Migration Ordering

Main D1 migrations live in `infra/cloudflare/migrations/` and use filenames beginning with a four-digit numeric prefix, for example `0015_seed_research_repository.sql`.

Future main D1 migrations must use a new, monotonically increasing four-digit prefix. Existing duplicate prefixes `0004` and `0005` are historical and already referenced by deployment workflows and route-state tests:

- `0004_auth_identity_route.sql`
- `0004_auth_login_challenges_locked_status.sql`
- `0005_auth_registration_requests.sql`
- `0005_auth_team_access_requests.sql`

Do not rename or renumber already-applied migration files. If an applied migration must be corrected, add a new migration with the next available main prefix and document the reason in the migration body or the related pull request.

The next main migration prefix after 0016_update_repository_seed_tag_taxonomy.sql is `0017`.

Preview seed migrations under `infra/cloudflare/migrations/preview/` use an independent sequence. Scoped migration folders such as `infra/cloudflare/migrations/researchops-d1/` also have their own local ordering contract.

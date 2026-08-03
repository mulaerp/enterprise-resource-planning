---
name: run-stack
description: Run the Mula ERP local stack with Docker Compose — use when asked to run the app, start the stack, restart backend, reset database, or check health.
---

# Run Stack

Mula ERP runs entirely via Docker Compose (`compose.yaml`) — frontend, backend, PostgreSQL, and Valkey. There is **no local Java** for the backend; any backend code change requires a container rebuild, not a local `mvn` run.

## Services

| Service    | Port | Notes                                      |
|------------|------|---------------------------------------------|
| frontend   | 5173 | Vite dev server                            |
| backend    | 8080 | Spring Boot, API prefixed `/api/v1`        |
| postgres   | 5432 | db `mulaerp`, user `mulaerp`               |
| valkey     | 6379 | cache / session store                      |

## Common commands

Start (build images if needed, run detached):
```
docker compose up --build -d
```

Stop:
```
docker compose down
```

Restart backend only after a code change (rebuild required — no hot local Java):
```
docker compose build backend
docker compose up -d backend
```

Tail backend logs:
```
docker compose logs -f backend
```

Check container status:
```
docker compose ps
```

## Health checks

Backend:
```
curl http://localhost:8080/actuator/health
```

Frontend (expect HTTP 200 / HTML root):
```
curl -I http://localhost:5173
```

## Resetting the database

```
docker compose down -v
docker compose up --build -d
```

`-v` removes the named volumes (`postgres-data`, `valkey-data`), destroying all data. On the next `up`, Flyway reapplies migrations from scratch against the fresh database — use this when you need a clean slate, not for routine restarts.

## Seeding demo data

Set `SEED_DEMO_DATA=true` (env var, defaults `false`) before `docker compose up` to seed a small synthetic thrift-store demo dataset (products, customers, members, sales, invoices, etc.) via `DemoDataSeeder` on backend startup. Idempotent — safe to leave on across restarts, it skips itself once product SKU `DEMO-0001` exists. See the `data-tools` skill for what it seeds.

## Flyway out-of-order (dev-only override)

`application.yml` sets `spring.flyway.out-of-order: ${FLYWAY_OUT_OF_ORDER:false}` — safe by
default, so a deploy that doesn't set the env var fails loudly on an out-of-order migration.
`compose.yaml`'s `backend` service sets `FLYWAY_OUT_OF_ORDER=${FLYWAY_OUT_OF_ORDER:-true}`, so the
local Docker stack tolerates it (some migrations landed out of numeric order across parallel
working sessions) — this dev default doesn't apply to `scripts/run-backend-tests.sh`'s throwaway
Postgres unless you export the same env var for that run too.

## Dev login accounts (five-role model, `V27__expand_role_model.sql`)

Independent of the demo-data flag above — these are always present. All password `admin123`:
`admin@mulaerp.com` (ADMIN), `manager@mulaerp.com` (MANAGER), `accountant@mulaerp.com`
(ACCOUNTANT), `inventory@mulaerp.com` (INVENTORY), `cashier@mulaerp.com` (CASHIER). See the
`personas` skill for which persona maps to which role.

## DB backup

The `db-backup` service is **not** started by `docker compose up` — it's behind a Compose profile. Start it explicitly:
```
docker compose --profile backup up -d
```
Dumps `postgres_backups/` every 24h via `pg_dump`, keeping 7 days.

## Optional AI trade-in matching (`ai` profile)

`ollama` is **not** started by `docker compose up` either — same pattern, behind its own profile so the default stack and CI are unaffected:
```
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull qwen2.5:0.5b   # one-off, ~400MB, persists in the ollama-models volume
```
Then set `TRADEIN_AI_MATCH_ENABLED=true` (`.env` or an env override on the `backend` service) and `docker compose up -d backend` — the flag defaults to `false`, so pulling the model alone does nothing until this is set. Warm the model once after pulling (avoids paying cold-load latency on the cashier's first real query — the container's `OLLAMA_KEEP_ALIVE=30m` then keeps it resident):
```
docker compose exec ollama ollama run qwen2.5:0.5b "warmup"
```
See the `pos` skill ("Trade-in product matching") for what this feature does (product matching only, never price) and the README's "AI trade-in matching (optional)" section for real measured latency and why it's left disabled by default. To turn it back off: unset `TRADEIN_AI_MATCH_ENABLED` (or set it `false`) and restart the backend — `docker compose stop ollama` is optional, the backend won't call out to it either way once the flag is off.

## Logs

Backend container logs are mounted to `./logs/backend` on the host (see the `backend` service volume in `compose.yaml`). Check there if `docker compose logs` isn't enough or you need persisted log files after the container stops.

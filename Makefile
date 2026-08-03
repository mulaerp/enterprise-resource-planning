# Mula ERP - developer convenience targets (WP8+9).
#
# No local Java/Maven on this machine - backend-test always runs inside Docker
# (see scripts/run-backend-tests.sh). Frontend targets run with the host's npm.

.PHONY: check backend-test frontend-check frontend-build e2e up down logs

# `check` is the pre-push gate (see .githooks/pre-push) - backend integration tests plus the
# frontend lint/typecheck pass. e2e-smoke is deliberately NOT included here: the Playwright suite
# takes noticeably longer and needs the full stack up, which doesn't belong in every push. Run it
# explicitly with `make e2e` when you want it.
check: backend-test frontend-check

# Runs the backend integration test suite (backend/src/test/java/com/mulaerp/it/**) against a
# throwaway Postgres + Valkey in Docker - never the live dev stack. See
# scripts/run-backend-tests.sh for the full strategy.
backend-test:
	./scripts/run-backend-tests.sh

# Lint + typecheck only (no build output). `npm run build` is `tsc -b && vite build` - this
# target runs the same typecheck (`tsc -b --noEmit`) without the vite bundling step, since a
# pre-push gate only needs to know the code is clean, not produce a dist/.
#
# NOTE (honesty flag, not a false-pass): as of this writing `npm run lint` fails with pre-existing
# errors in frontend/src unrelated to WP8+9 - frontend/src is out of scope for this change, so
# they are left as-is. `npx tsc -b --noEmit` on its own is clean.
frontend-check:
	cd frontend && npm run lint && npx tsc -b --noEmit

# Full frontend production build (tsc -b && vite build), output to frontend/dist.
frontend-build:
	cd frontend && npm run build

# Playwright end-to-end suite, dockerized (brings the full stack up, waits for health, runs
# Playwright in a container against it). See scripts/run-e2e-docker.sh.
e2e:
	./scripts/run-e2e-docker.sh

# Dev stack conveniences (compose project `enterprise-resource-planning`).
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

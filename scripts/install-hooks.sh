#!/bin/bash
# Mula ERP - opt-in installer for the repo's git hooks (WP8+9).
#
# This script does NOT run itself as part of any other automation - it's meant to be run once,
# manually, by a developer who wants the pre-push `make check` gate active locally:
#
#   ./scripts/install-hooks.sh
#
# It points git at the repo-tracked .githooks/ directory (git config core.hooksPath .githooks)
# instead of the untracked .git/hooks/. That's a repo-local git config change, which is why this
# script performs it rather than being run automatically for you.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/pre-push

echo "✓ core.hooksPath set to .githooks - 'make check' will now run before every 'git push' in this repo clone."
echo "  To undo: git config --unset core.hooksPath"

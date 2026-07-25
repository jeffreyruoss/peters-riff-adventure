#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch.
#
# This does the deploy from the client rather than via a GitHub Actions
# workflow, because that would need a token with the `workflow` scope.
# If you'd rather have CI build on every push, run:
#   gh auth refresh -s workflow
# and add a .github/workflows/pages.yml instead.
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE=$(git remote get-url origin)
BRANCH=gh-pages
MSG="deploy $(git rev-parse --short HEAD) $(date -u +%Y-%m-%dT%H:%M:%SZ)"

npm run build

# dist/ is gitignored in the main repo, so it gets its own throwaway history
# that is force-pushed to gh-pages.
rm -rf dist/.git
git -C dist init -q -b "$BRANCH"
git -C dist add -A
git -C dist -c user.name="$(git config user.name)" \
             -c user.email="$(git config user.email)" \
             commit -qm "$MSG"
git -C dist push -q --force "$REMOTE" "$BRANCH:$BRANCH"
rm -rf dist/.git

echo "pushed to $BRANCH"

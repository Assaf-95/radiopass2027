#!/usr/bin/env bash
#
# Runs the test suite.
#
# Why this script exists: this checkout currently lives under a directory whose
# name contains colons (".../:Users:User1:Desktop:RadioPass."). Vitest cannot
# load modules through such a path — it drops everything before the last colon
# and then fails with "Cannot find module '/src/...'". Vite's own dev server and
# production build are unaffected; only the test runner trips over it.
#
# So the sources are mirrored into a colon-free directory, with node_modules
# symlinked rather than copied, and vitest runs there. Coverage of what is
# tested is identical because the mirror is a byte-for-byte copy of src/.
#
# The mirror is unique per invocation. A single shared mirror looked tidier but
# is unsafe: two runs at once (a watch process, another session, or just two
# terminals) have their sources deleted out from under them by the other's
# rsync --delete, which shows up as "no tests" or a scatter of impossible
# failures rather than as an obvious collision.
#
# If the project is ever moved to a path without colons this script becomes
# unnecessary: "vitest run" can be called directly.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$PROJECT_DIR" in
  *:*)
    ;;
  *)
    # No colons in the path — run directly and skip the mirror entirely.
    exec "$PROJECT_DIR/node_modules/.bin/vitest" "${@:-run}"
    ;;
esac

MIRROR_DIR="$(mktemp -d "${TMPDIR:-/tmp}/radiopass-tests-XXXXXX")"
cleanup() {
  rm -rf "$MIRROR_DIR"
}
trap cleanup EXIT

rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "$PROJECT_DIR/" "$MIRROR_DIR/"

ln -sfn "$PROJECT_DIR/node_modules" "$MIRROR_DIR/node_modules"

cd "$MIRROR_DIR"
./node_modules/.bin/vitest "${@:-run}"

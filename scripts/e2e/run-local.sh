#!/usr/bin/env bash
set -euo pipefail

# This script is intended to run on your local workstation.
# It builds extension artifacts and executes real-browser E2E tests.

REPO_DIR="${1:-$(pwd)}"
cd "${REPO_DIR}"

npm install
npx playwright install chromium firefox

# Default: run cross-browser real-browser tests.
# Set E2E_RUN_EXTENSION=1 to include extension-loaded Chromium test.
if [[ "${E2E_RUN_EXTENSION:-0}" == "1" && -z "${DISPLAY:-}" ]]; then
  echo "E2E_RUN_EXTENSION=1 requires a display (or run under xvfb-run)." >&2
  exit 1
fi

make test-e2e-local

#!/usr/bin/env bash
set -euo pipefail

# Run from remote development server.
# Syncs current repo to a local machine and runs local real-browser E2E tests.

LOCAL_E2E_HOST="${LOCAL_E2E_HOST:-}"
LOCAL_E2E_DIR="${LOCAL_E2E_DIR:-~/webviewmcp}"
RUN_EXTENSION="${E2E_RUN_EXTENSION:-0}"

if [[ -z "${LOCAL_E2E_HOST}" ]]; then
  echo "LOCAL_E2E_HOST is required (example: export LOCAL_E2E_HOST=user@my-laptop)" >&2
  exit 1
fi

rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude coverage \
  ./ "${LOCAL_E2E_HOST}:${LOCAL_E2E_DIR}/"

ssh "${LOCAL_E2E_HOST}" "cd ${LOCAL_E2E_DIR} && E2E_RUN_EXTENSION=${RUN_EXTENSION} ./scripts/e2e/run-local.sh ${LOCAL_E2E_DIR}"

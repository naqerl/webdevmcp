#!/usr/bin/env bash
set -euo pipefail

# Run from remote development server.
# Executes tests on a local/home machine over SSH.
#
# Required:
# - LOCAL_E2E_TARGET in format user@host:/absolute/path
# Optional:
# - LOCAL_E2E_PORT (default: 22)
# - BRANCH (checkout + pull before tests)
# - E2E_RUN_EXTENSION (default: 0)

LOCAL_E2E_TARGET="${LOCAL_E2E_TARGET:-}"
LOCAL_E2E_PORT="${LOCAL_E2E_PORT:-22}"
BRANCH_NAME="${BRANCH:-}"
RUN_EXTENSION="${E2E_RUN_EXTENSION:-0}"

if [[ -z "${LOCAL_E2E_TARGET}" ]]; then
  echo "LOCAL_E2E_TARGET is required (example: user@localhost:/home/user/code/webviewmcp)" >&2
  exit 1
fi

if [[ "${LOCAL_E2E_TARGET}" != *:* ]]; then
  echo "LOCAL_E2E_TARGET must be in format user@host:/absolute/path" >&2
  exit 1
fi

REMOTE_HOST="${LOCAL_E2E_TARGET%%:*}"
REMOTE_PATH="${LOCAL_E2E_TARGET#*:}"

if [[ -z "${REMOTE_HOST}" || -z "${REMOTE_PATH}" ]]; then
  echo "Failed to parse LOCAL_E2E_TARGET" >&2
  exit 1
fi

if [[ "${REMOTE_PATH}" != /* ]]; then
  echo "Path in LOCAL_E2E_TARGET must be absolute" >&2
  exit 1
fi

if [[ -n "${BRANCH_NAME}" && ! "${BRANCH_NAME}" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "BRANCH contains unsupported characters" >&2
  exit 1
fi

ssh -p "${LOCAL_E2E_PORT}" \
  "${REMOTE_HOST}" \
  REMOTE_PATH="${REMOTE_PATH}" \
  BRANCH_NAME="${BRANCH_NAME}" \
  RUN_EXTENSION="${RUN_EXTENSION}" \
  "bash -s" <<'EOF'
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
  fi

  if [[ -s "$HOME/.profile" ]]; then
    # shellcheck source=/dev/null
    . "$HOME/.profile"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on remote machine; ensure Node.js is installed and available for SSH sessions" >&2
  exit 127
fi

cd "${REMOTE_PATH}"

if [[ -n "${BRANCH_NAME}" ]]; then
  git fetch --all --prune
  git checkout "${BRANCH_NAME}"
  git pull --ff-only origin "${BRANCH_NAME}"
fi

E2E_RUN_EXTENSION="${RUN_EXTENSION}" ./scripts/e2e/run-local.sh "${REMOTE_PATH}"
EOF

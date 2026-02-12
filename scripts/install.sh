#!/usr/bin/env bash
set -euo pipefail

REPO="${WEBVIEWMCP_REPO:-naqerl/webdevmcp}"
BIN_DIR="${WEBVIEWMCP_BIN_DIR:-$HOME/.local/bin}"
DATA_DIR="${WEBVIEWMCP_DATA_DIR:-$HOME/.local/share/webviewmcp}"
TMP_DIR="$(mktemp -d)"
TOTAL_STEPS=5
CURRENT_STEP=0

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd unzip

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo
  echo "[${CURRENT_STEP}/${TOTAL_STEPS}] $1"
}

step "Preparing directories"
mkdir -p "$BIN_DIR" "$DATA_DIR/extensions"

case "$(uname -s)" in
  Linux) OS="linux" ;;
  Darwin) OS="macos" ;;
  *)
    echo "unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

COMPANION_ASSET="webviewmcp-companion-${OS}-${ARCH}"
BASE_URL="https://github.com/${REPO}/releases/latest/download"

CHROMIUM_ZIP="$TMP_DIR/webviewmcp-chromium.zip"
FIREFOX_ZIP="$TMP_DIR/webviewmcp-firefox.zip"
COMPANION_BIN="$TMP_DIR/webviewmcp-companion"

fetch_asset() {
  local asset="$1"
  local out="$2"
  local url="${BASE_URL}/${asset}"
  echo "  - downloading ${asset}"
  curl -fL --retry 3 --retry-delay 2 "$url" -o "$out"
}

step "Downloading release assets (with ETA)"
fetch_asset "webviewmcp-chromium.zip" "$CHROMIUM_ZIP"
fetch_asset "webviewmcp-firefox.zip" "$FIREFOX_ZIP"
fetch_asset "$COMPANION_ASSET" "$COMPANION_BIN"

step "Installing companion binary"
chmod +x "$COMPANION_BIN"
install -m 0755 "$COMPANION_BIN" "$BIN_DIR/webviewmcp-companion"

EXT_CHROMIUM_DIR="$DATA_DIR/extensions/chromium"
EXT_FIREFOX_DIR="$DATA_DIR/extensions/firefox"

rm -rf "$EXT_CHROMIUM_DIR" "$EXT_FIREFOX_DIR"
mkdir -p "$EXT_CHROMIUM_DIR" "$EXT_FIREFOX_DIR"

step "Unpacking extension payloads"
unzip -q "$CHROMIUM_ZIP" -d "$EXT_CHROMIUM_DIR"
unzip -q "$FIREFOX_ZIP" -d "$EXT_FIREFOX_DIR"

step "Finalizing installation"
echo "Installation complete."
echo "Companion binary: $BIN_DIR/webviewmcp-companion"
echo "If $BIN_DIR is not in PATH, add: export PATH=\"$BIN_DIR:\$PATH\""
echo "Chromium extension files: $EXT_CHROMIUM_DIR"
echo "Firefox extension file: $EXT_FIREFOX_DIR/webviewmcp@local.xpi"
echo "Install extension manually in your browser if you do not use Playwright-driven launch."

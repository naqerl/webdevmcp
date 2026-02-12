#!/usr/bin/env bash
set -euo pipefail

REPO="${WEBVIEWMCP_REPO:-naqerl/webdevmcp}"
BIN_DIR="${WEBVIEWMCP_BIN_DIR:-$HOME/.local/bin}"
DATA_DIR="${WEBVIEWMCP_DATA_DIR:-$HOME/.local/share/webviewmcp}"
TMP_DIR="$(mktemp -d)"

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

COMPANION_ASSET="webdev-${OS}-${ARCH}"
BASE_URL="https://github.com/${REPO}/releases/latest/download"

CHROMIUM_ZIP="$TMP_DIR/webviewmcp-chromium.zip"
FIREFOX_ZIP="$TMP_DIR/webviewmcp-firefox.zip"
COMPANION_BIN="$TMP_DIR/webdev"

fetch_asset() {
  local asset="$1"
  local out="$2"
  local url="${BASE_URL}/${asset}"
  curl -fL --progress-bar --retry 3 --retry-delay 2 "$url" -o "$out"
}

fetch_asset "webviewmcp-chromium.zip" "$CHROMIUM_ZIP"
fetch_asset "webviewmcp-firefox.zip" "$FIREFOX_ZIP"
fetch_asset "$COMPANION_ASSET" "$COMPANION_BIN"

chmod +x "$COMPANION_BIN"
install -m 0755 "$COMPANION_BIN" "$BIN_DIR/webdev"

EXT_CHROMIUM_DIR="$DATA_DIR/extensions/chromium"
EXT_FIREFOX_DIR="$DATA_DIR/extensions/firefox"

rm -rf "$EXT_CHROMIUM_DIR" "$EXT_FIREFOX_DIR"
mkdir -p "$EXT_CHROMIUM_DIR" "$EXT_FIREFOX_DIR"

unzip -q "$CHROMIUM_ZIP" -d "$EXT_CHROMIUM_DIR"
unzip -q "$FIREFOX_ZIP" -d "$EXT_FIREFOX_DIR"

echo "Installation complete."
echo "Run: webdev"

#!/usr/bin/env bash
set -euo pipefail

REPO="${WEBVIEWMCP_REPO:-naqerl/webdevmcp}"
BIN_DIR="${WEBVIEWMCP_BIN_DIR:-$HOME/.local/bin}"
DATA_DIR="${WEBVIEWMCP_DATA_DIR:-$HOME/.local/share/webviewmcp}"
TMP_DIR="$(mktemp -d)"
TOTAL_STEPS=7
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

has_flatpak_app() {
  local app_id="$1"
  command -v flatpak >/dev/null 2>&1 && flatpak info "$app_id" >/dev/null 2>&1
}

declare -a IDS=()
declare -a LABELS=()
declare -a KINDS=()
declare -a RUNNERS=()
declare -a SOURCES=()

add_browser() {
  IDS+=("$1")
  LABELS+=("$2")
  KINDS+=("$3")
  RUNNERS+=("$4")
  SOURCES+=("$5")
}

if command -v google-chrome >/dev/null 2>&1; then add_browser "chrome" "Google Chrome" "chromium" "google-chrome" "native"; fi
if command -v chromium >/dev/null 2>&1; then add_browser "chromium" "Chromium" "chromium" "chromium" "native"; fi
if command -v brave-browser >/dev/null 2>&1; then add_browser "brave" "Brave" "chromium" "brave-browser" "native"; fi
if command -v microsoft-edge >/dev/null 2>&1; then add_browser "edge" "Microsoft Edge" "chromium" "microsoft-edge" "native"; fi
if command -v firefox >/dev/null 2>&1; then add_browser "firefox" "Firefox" "firefox" "firefox" "native"; fi

if has_flatpak_app com.google.Chrome; then add_browser "chrome-flatpak" "Google Chrome (Flatpak)" "chromium" "com.google.Chrome" "flatpak"; fi
if has_flatpak_app org.chromium.Chromium; then add_browser "chromium-flatpak" "Chromium (Flatpak)" "chromium" "org.chromium.Chromium" "flatpak"; fi
if has_flatpak_app com.brave.Browser; then add_browser "brave-flatpak" "Brave (Flatpak)" "chromium" "com.brave.Browser" "flatpak"; fi
if has_flatpak_app com.microsoft.Edge; then add_browser "edge-flatpak" "Microsoft Edge (Flatpak)" "chromium" "com.microsoft.Edge" "flatpak"; fi
if has_flatpak_app org.mozilla.firefox; then add_browser "firefox-flatpak" "Firefox (Flatpak)" "firefox" "org.mozilla.firefox" "flatpak"; fi

if [[ ${#IDS[@]} -eq 0 ]]; then
  echo "No supported browsers were detected." >&2
  exit 1
fi

step "Detected browsers"
echo "Detected browsers:"
for i in "${!IDS[@]}"; do
  n=$((i + 1))
  echo "  ${n}) ${LABELS[$i]}"
done

echo
read -r -p "Select browser numbers (comma-separated, or 'all'): " selection

if [[ -z "$selection" || "$selection" == "all" ]]; then
  selection=$(seq -s, 1 "${#IDS[@]}")
fi

selection="${selection// /}"
IFS=',' read -r -a picked <<< "$selection"

declare -A CHOSEN=()
for token in "${picked[@]}"; do
  if [[ "$token" =~ ^[0-9]+$ ]] && (( token >= 1 && token <= ${#IDS[@]} )); then
    CHOSEN[$((token - 1))]=1
  else
    echo "Invalid selection: $token" >&2
    exit 1
  fi
done

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

create_chromium_wrapper() {
  local wrapper_path="$1"
  local runner="$2"
  local source="$3"

  if [[ "$source" == "flatpak" ]]; then
    cat > "$wrapper_path" <<SCRIPT
#!/usr/bin/env bash
exec flatpak run "$runner" --disable-extensions-except="$EXT_CHROMIUM_DIR" --load-extension="$EXT_CHROMIUM_DIR" "\$@"
SCRIPT
  else
    cat > "$wrapper_path" <<SCRIPT
#!/usr/bin/env bash
exec "$runner" --disable-extensions-except="$EXT_CHROMIUM_DIR" --load-extension="$EXT_CHROMIUM_DIR" "\$@"
SCRIPT
  fi

  chmod +x "$wrapper_path"
}

create_firefox_wrapper() {
  local wrapper_path="$1"
  local runner="$2"
  local source="$3"
  local profile_dir="$4"

  if [[ "$source" == "flatpak" ]]; then
    cat > "$wrapper_path" <<SCRIPT
#!/usr/bin/env bash
exec flatpak run "$runner" --profile "$profile_dir" "\$@"
SCRIPT
  else
    cat > "$wrapper_path" <<SCRIPT
#!/usr/bin/env bash
exec "$runner" --profile "$profile_dir" "\$@"
SCRIPT
  fi

  chmod +x "$wrapper_path"
}

prepare_managed_firefox_profile() {
  local profile_dir="$1"
  mkdir -p "$profile_dir/extensions"
  cp "$FIREFOX_ZIP" "$profile_dir/extensions/webviewmcp@local.xpi"
}

find_firefox_profile() {
  local root="$1"
  local ini
  local selected
  local is_relative
  local path_value
  local resolved

  if [[ ! -d "$root" ]]; then
    return 1
  fi

  ini="$root/profiles.ini"
  if [[ -f "$ini" ]]; then
    selected="$(
      awk '
        BEGIN {
          RS = "";
          FS = "\n";
          first = "";
          chosen = "";
        }
        /^\[Profile/ {
          path = "";
          is_relative = "1";
          is_default = "0";

          for (i = 1; i <= NF; i++) {
            split($i, kv, "=");
            key = kv[1];
            val = kv[2];
            if (key == "Path") path = val;
            if (key == "IsRelative") is_relative = val;
            if (key == "Default") is_default = val;
          }

          if (path != "") {
            entry = is_relative ":" path;
            if (first == "") first = entry;
            if (is_default == "1") chosen = entry;
          }
        }
        END {
          if (chosen != "") {
            print chosen;
          } else if (first != "") {
            print first;
          }
        }
      ' "$ini"
    )"

    if [[ -n "$selected" ]]; then
      is_relative="${selected%%:*}"
      path_value="${selected#*:}"
      if [[ "$is_relative" == "1" ]]; then
        resolved="$root/$path_value"
      else
        resolved="$path_value"
      fi

      if [[ -d "$resolved" ]]; then
        echo "$resolved"
        return 0
      fi
    fi
  fi

  resolved="$(
    find "$root" -maxdepth 2 -type d \
      \( -name "*.default-release" -o -name "*.default*" -o -name "*.dev-edition-default*" \) \
      | head -n1 || true
  )"
  if [[ -z "$resolved" ]]; then
    return 1
  fi

  echo "$resolved"
}

install_firefox_xpi() {
  local profile_root="$1"
  local profile

  profile=$(find_firefox_profile "$profile_root") || return 1

  mkdir -p "$profile/extensions"
  cp "$FIREFOX_ZIP" "$profile/extensions/webviewmcp@local.xpi"
  return 0
}

failures=0

step "Installing browser integrations"
for i in "${!IDS[@]}"; do
  if [[ -z "${CHOSEN[$i]:-}" ]]; then
    continue
  fi

  browser_id="${IDS[$i]}"
  browser_kind="${KINDS[$i]}"
  runner="${RUNNERS[$i]}"
  source="${SOURCES[$i]}"

  if [[ "$browser_kind" == "chromium" ]]; then
    wrapper="$BIN_DIR/webviewmcp-${browser_id}"
    create_chromium_wrapper "$wrapper" "$runner" "$source"
    echo "Installed launcher: $wrapper"
    continue
  fi

  if [[ "$browser_kind" == "firefox" ]]; then
    managed_profile_dir="$DATA_DIR/firefox-profiles/$browser_id"
    firefox_wrapper="$BIN_DIR/webviewmcp-${browser_id}"
    prepare_managed_firefox_profile "$managed_profile_dir"
    create_firefox_wrapper "$firefox_wrapper" "$runner" "$source" "$managed_profile_dir"
    echo "Installed launcher: $firefox_wrapper"

    if [[ "$source" == "flatpak" ]]; then
      if install_firefox_xpi "$HOME/.var/app/org.mozilla.firefox/.mozilla/firefox"; then
        echo "Installed Firefox extension in Flatpak profile"
      else
        echo "Could not update existing Flatpak Firefox profile." >&2
        echo "Use launcher $firefox_wrapper to run Firefox with webviewmcp profile." >&2
      fi
    else
      if install_firefox_xpi "$HOME/.mozilla/firefox"; then
        echo "Installed Firefox extension in default profile"
      else
        echo "Could not update existing Firefox profile." >&2
        echo "Use launcher $firefox_wrapper to run Firefox with webviewmcp profile." >&2
      fi
    fi
  fi
done

step "Finalizing installation"
if (( failures > 0 )); then
  echo "Installation completed with ${failures} error(s)." >&2
  exit 1
fi

echo "Installation complete."
echo "Companion binary: $BIN_DIR/webviewmcp-companion"
echo "If $BIN_DIR is not in PATH, add: export PATH=\"$BIN_DIR:\$PATH\""
echo "Selected browsers should be launched via installed webviewmcp-* wrappers."
echo "Firefox extension install may require developer-enabled Firefox builds if unsigned add-ons are restricted."

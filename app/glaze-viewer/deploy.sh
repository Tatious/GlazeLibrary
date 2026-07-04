#!/usr/bin/env bash
#
# deploy.sh — Deploy the Glaze Viewer app to Azure App Service.
#
# Glaze Viewer is an Express server (server/index.js) that serves the built
# React SPA (dist/) and the /api/* backend, running on Azure App Service
# (Linux, Node 22). SQLite lives on the persisted /home volume; images + data
# are served from Azure Blob Storage. It is NOT a static site — deploy the
# WHOLE app as one zip.
#
# What this script does (automates the manual recipe in DEPLOY.md):
#   1. Build the SPA locally:  NODE_ENV=production npm run build  (NODE_ENV is
#      required — vite.config.ts only sets publicDir:false in production, which
#      keeps the multi-MB public/images tree out of dist/).
#   2. Assemble deploy_pkg/ = dist + server + package.json + package-lock.json,
#      WITHOUT node_modules (Azure/Oryx installs deps itself and compiles the
#      native better-sqlite3 for Linux) and WITHOUT any secrets / local DB.
#   3. Strip build scripts from the package's package.json so Oryx does not try
#      to run `tsc -b && vite build` on the server (devDeps are absent under
#      NODE_ENV=production → "tsc: not found"). We already built dist/ locally.
#   4. Zip it and push with:  stop → deploy → start  as SEPARATE steps.
#
# One-time setup (NOT done here — see DEPLOY.md):
#   - App Settings: NODE_ENV=production, PORT=8080,
#     SCM_DO_BUILD_DURING_DEPLOYMENT=true, ALLOWED_ORIGINS,
#     FIREBASE_SERVICE_ACCOUNT (JSON one-liner), AZURE_STORAGE_CONNECTION_STRING,
#     AZURE_STORAGE_CONTAINER.
#   - Startup command: node server/index.js
#   - Firebase Console → Auth → Authorized domains must include every host.
#
# Usage:
#   ./deploy.sh                 build, package, and deploy (asks to confirm)
#   ./deploy.sh -y              skip the confirmation prompt
#   ./deploy.sh --package-only  build the deploy.zip but do NOT push to Azure
#   ./deploy.sh --skip-build    reuse the existing dist/ (don't rebuild)
#   ./deploy.sh -h              show help
#
# Config can be overridden via env vars, e.g.:
#   APP_NAME=glaze-staging RESOURCE_GROUP=glaze-rg ./deploy.sh
#   SUBSCRIPTION="My Sub" ./deploy.sh      # else the CLI's current default
#
set -euo pipefail

# ── output helpers ──────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=''; RED=''; GREEN=''; YELLOW=''; BLUE=''; RESET=''
fi
log()  { printf '%s\n' "${BLUE}${BOLD}==>${RESET} $*"; }
info() { printf '%s\n' "    $*"; }
warn() { printf '%s\n' "${YELLOW}warning:${RESET} $*" >&2; }
die()  { printf '%s\n' "${RED}error:${RESET} $*" >&2; exit 1; }

usage() {
  sed -n '3,40p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# ── flags ───────────────────────────────────────────────────────────────────
ASSUME_YES=0
SKIP_BUILD=0
PACKAGE_ONLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)       ASSUME_YES=1 ;;
    --skip-build)   SKIP_BUILD=1 ;;
    --package-only) PACKAGE_ONLY=1 ;;
    -h|--help)      usage ;;
    *)              die "unknown option: $1 (try -h)" ;;
  esac
  shift
done

# ── configuration (override via env) ────────────────────────────────────────
RESOURCE_GROUP="${RESOURCE_GROUP:-glaze-viewer-rg}"
APP_NAME="${APP_NAME:-glaze-viewer}"
# Leave SUBSCRIPTION empty to use the Azure CLI's currently-selected account.
SUBSCRIPTION="${SUBSCRIPTION:-}"
APP_HOST="${APP_HOST:-glaze-viewer-c4e9ahdnhnffajed.canadacentral-01.azurewebsites.net}"
APP_URL="https://${APP_HOST}"

PKG_DIR="deploy_pkg"
ZIP="deploy.zip"

# Run from the app dir (this script lives there) so relative paths resolve.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Wrapper: run an `az` command, appending --subscription only when one is set.
# (Keeps us bash-3.2 safe — no array expansion under `set -u`.)
az_() {
  if [[ -n "$SUBSCRIPTION" ]]; then
    az "$@" --subscription "$SUBSCRIPTION"
  else
    az "$@"
  fi
}

# ── safety net: never leave the app stopped ─────────────────────────────────
APP_STOPPED=0
cleanup() {
  local code=$?
  if [[ $APP_STOPPED -eq 1 && $code -ne 0 ]]; then
    warn "Aborted with the app stopped — trying to start it again so the site isn't left down…"
    az_ webapp start -g "$RESOURCE_GROUP" -n "$APP_NAME" >/dev/null 2>&1 \
      || warn "Could not auto-start. Run: az webapp start -g $RESOURCE_GROUP -n $APP_NAME"
  fi
}
trap cleanup EXIT

# ── preflight ───────────────────────────────────────────────────────────────
log "Preflight checks…"
command -v node >/dev/null || die "node not found."
command -v npm  >/dev/null || die "npm not found."
command -v zip  >/dev/null || die "zip not found (needed to build the package)."
if [[ $PACKAGE_ONLY -eq 0 ]]; then
  command -v az >/dev/null || die "Azure CLI (az) not found. Install: https://aka.ms/azure-cli"
  az account show >/dev/null 2>&1 || die "Not logged in to Azure. Run: az login"
  if [[ -n "$SUBSCRIPTION" ]]; then
    az account set --subscription "$SUBSCRIPTION" >/dev/null 2>&1 \
      || die "Cannot select subscription '$SUBSCRIPTION'. Check 'az account list'."
  fi
fi
command -v curl >/dev/null || warn "curl not found — will skip the post-deploy health check."

if [[ ! -f .env.production ]]; then
  warn ".env.production is missing. The build bakes VITE_* (Firebase config, the"
  warn "Azure CDN URL) into dist/ at build time; without it the bundle ships"
  warn "empty config and auth / images break."
fi
[[ -f package-lock.json ]] || warn "package-lock.json missing — Oryx install won't be reproducible."

# ── 1. build the SPA ────────────────────────────────────────────────────────
if [[ $SKIP_BUILD -eq 0 ]]; then
  log "Building the frontend (NODE_ENV=production npm run build)…"
  NODE_ENV=production npm run build
else
  [[ -d dist ]] || die "--skip-build was given but dist/ does not exist. Build first."
  info "Reusing existing dist/ (--skip-build)."
fi

# ── 2. assemble the deploy package ──────────────────────────────────────────
log "Assembling ${PKG_DIR}/ (no node_modules, no secrets)…"
rm -rf "$PKG_DIR" "$ZIP"
mkdir "$PKG_DIR"
cp -R dist "$PKG_DIR"/
cp -R server "$PKG_DIR"/
cp package.json "$PKG_DIR"/
[[ -f package-lock.json ]] && cp package-lock.json "$PKG_DIR"/

# Drop secrets and local-only runtime state that must NEVER reach Azure.
rm -f  "$PKG_DIR/server/firebase-service-account.json"
rm -f  "$PKG_DIR/server/.env"
rm -rf "$PKG_DIR/server/data"

# ── 3. strip build/dev scripts from the package's package.json ──────────────
# With SCM_DO_BUILD_DURING_DEPLOYMENT=true, Oryx runs `npm run build` on the
# server if a `build` script exists. Our build is `tsc -b && vite build`, but
# tsc/vite are devDependencies that NODE_ENV=production skips → "tsc: not
# found". dist/ is already built locally, so remove the frontend build scripts.
log "Stripping build scripts from the package's package.json…"
node -e 'const fs=require("fs"),f=process.argv[1],p=JSON.parse(fs.readFileSync(f));for(const k of ["build","build:prod","copy-static"])delete (p.scripts||{})[k];fs.writeFileSync(f,JSON.stringify(p,null,2)+"\n")' "$PKG_DIR/package.json"

# ── guards: no node_modules, no secrets ─────────────────────────────────────
[[ -d "$PKG_DIR/node_modules" ]] && die "node_modules leaked into the package."
for leak in server/firebase-service-account.json server/.env server/data; do
  [[ -e "$PKG_DIR/$leak" ]] && die "secret/local state '$leak' is still in the package."
done

# ── 4. zip ──────────────────────────────────────────────────────────────────
log "Zipping → ${ZIP} …"
( cd "$PKG_DIR" && zip -rq "../$ZIP" . )
zip_bytes=$(wc -c < "$ZIP" | tr -d ' ')
info "Package size: $(( zip_bytes / 1024 )) KB"
if [[ $zip_bytes -gt 5242880 ]]; then
  warn "Package is $(( zip_bytes / 1024 / 1024 )) MB (>5 MB) — node_modules or the"
  warn "public/images tree may have snuck in. Inspect before pushing."
fi

if [[ $PACKAGE_ONLY -eq 1 ]]; then
  log "${GREEN}Done.${RESET} Built ${ZIP} (‑‑package-only; not deployed)."
  exit 0
fi

# ── confirm (live production site) ──────────────────────────────────────────
if [[ $ASSUME_YES -eq 0 ]]; then
  printf '\n%s\n' "${BOLD}About to deploy to a LIVE site:${RESET}"
  printf '  %-13s %s\n' "Subscription" "${SUBSCRIPTION:-<CLI default>}"
  printf '  %-13s %s\n' "Resource grp" "$RESOURCE_GROUP"
  printf '  %-13s %s\n' "App Service"  "$APP_NAME"
  printf '  %-13s %s\n\n' "URL"        "$APP_URL"
  read -r -p "Type 'deploy' to continue: " reply || true
  [[ "${reply:-}" == "deploy" ]] || die "Aborted."
fi

# ── 5. push: stop → deploy → start (SEPARATE steps, deliberately) ───────────
log "Stopping the app (lets Oryx replace node_modules without file locks)…"
az_ webapp stop -g "$RESOURCE_GROUP" -n "$APP_NAME"
APP_STOPPED=1

log "Deploying the zip (Oryx runs npm install + compiles better-sqlite3)…"
info "A gateway timeout printed here while Azure installs is normal."
az_ webapp deploy \
  -g "$RESOURCE_GROUP" -n "$APP_NAME" \
  --src-path "$ZIP" --type zip --track-status false

log "Starting the app (its own step — never rely on 'stop && deploy; start')…"
az_ webapp start -g "$RESOURCE_GROUP" -n "$APP_NAME"
APP_STOPPED=0

# ── 6. verify ───────────────────────────────────────────────────────────────
if command -v curl >/dev/null; then
  log "Verifying ${APP_URL} (Oryx install can take a few minutes)…"
  ok=0
  for i in $(seq 1 24); do
    code=$(curl -fsS -o /dev/null -w '%{http_code}' "$APP_URL/api/health" 2>/dev/null || true)
    if [[ "$code" == "200" ]]; then ok=1; break; fi
    info "waiting for the app to come up… (attempt ${i}/24, status ${code:-none})"
    sleep 10
  done
  if [[ $ok -eq 1 ]]; then
    log "${GREEN}Live:${RESET} ${APP_URL}  (/api/health → 200)"
  else
    warn "No 200 from /api/health yet. Watch logs:"
    warn "  az webapp log tail -g $RESOURCE_GROUP -n $APP_NAME"
  fi
else
  log "${GREEN}Deploy pushed.${RESET} Verify manually: curl -I ${APP_URL}"
fi

log "Done."

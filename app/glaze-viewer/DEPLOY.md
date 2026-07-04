# Glaze Viewer — Azure Deployment

## Resources

| Resource | Value |
|---|---|
| Resource Group | `glaze-viewer-rg` |
| App Service | `glaze-viewer` (Linux, Node 22 LTS) |
| App URL | https://glaze-viewer-c4e9ahdnhnffajed.canadacentral-01.azurewebsites.net |
| Kudu URL | https://glaze-viewer-c4e9ahdnhnffajed.scm.canadacentral-01.azurewebsites.net |
| Storage Account | `glazeviewerstorage` |
| Blob Container | `public` (`https://glazeviewerstorage.blob.core.windows.net/public`) |

## Required App Service Settings

Set these under **Configuration → Application settings** (or via `az webapp config appsettings set`):

| Name | Value / Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` — required so Azure runs `npm install` (including native build of `better-sqlite3`) |
| `ALLOWED_ORIGINS` | Comma-separated origin allowlist. **Server exits at startup if missing in production.** Include the App Service URL and any custom domain. |
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON contents of the Firebase service account key (one line). Never commit `firebase-service-account.json` to the deploy zip. |
| `AZURE_STORAGE_CONNECTION_STRING` | From Storage Account → Access keys |
| `AZURE_STORAGE_CONTAINER` | `public` |
| `GLAZE_DB_PATH` | *(optional)* defaults to `/home/data/glaze.db`. `/home` is the only persisted path on App Service Linux — do **not** point it elsewhere. |

## Startup Command

One-time (already configured on `glaze-viewer`; re-running is idempotent):

```bash
az webapp config set -g glaze-viewer-rg -n glaze-viewer --startup-file "node server/index.js"
```

## Firebase Console (one-time — not an Azure setting)

Firebase Auth blocks sign-in from any host not on its **Authorized domains**
list. In Firebase Console → **Authentication → Settings → Authorized domains**,
add every browser-facing host:

- `glazelibrary.com`
- `www.glazelibrary.com`
- `glaze-viewer-c4e9ahdnhnffajed.canadacentral-01.azurewebsites.net`

(`localhost` and `*.firebaseapp.com` are present by default.) These must mirror
the hosts in `ALLOWED_ORIGINS` above.

---

## Deploy

### One command (recommended)

[`deploy.sh`](./deploy.sh) automates every step below — build, package (no
`node_modules`, no secrets), strip build scripts, zip, and push via
stop → deploy → start, then polls `/api/health` until the site is live.

```bash
cd app/glaze-viewer
./deploy.sh                 # build, package, deploy (prompts to confirm)
./deploy.sh -y              # skip the confirmation prompt
./deploy.sh --package-only  # build deploy.zip only; don't push to Azure
./deploy.sh --skip-build    # reuse the existing dist/
```

Config is overridable via env vars (`RESOURCE_GROUP`, `APP_NAME`, `APP_HOST`,
`SUBSCRIPTION`); `SUBSCRIPTION` defaults to the Azure CLI's selected account.

The manual steps below are what the script runs, kept for reference / debugging.

### 1. Build the frontend

```bash
cd app/glaze-viewer
NODE_ENV=production npm run build
```

`NODE_ENV=production` is required: `vite.config.ts` only sets `publicDir: false`
when it is set, which keeps the multi-MB `public/images` tree out of `dist/`.
Images and data are served from the Azure blob CDN (`VITE_AZURE_CDN_URL`), never
from the app, so they must not be bundled.

### 2. Build the deploy package (no `node_modules`)

Azure installs deps itself; including them locally causes the CLI to hang on the optimization step and breaks native modules (`better-sqlite3`) compiled for macOS.

```bash
cd app/glaze-viewer
rm -rf deploy_pkg deploy.zip
mkdir deploy_pkg

cp -r dist deploy_pkg/
cp -r server deploy_pkg/
cp package.json package-lock.json deploy_pkg/

# Drop secrets and local-only state that must never reach Azure
rm -f deploy_pkg/server/firebase-service-account.json
rm -f deploy_pkg/server/.env
rm -rf deploy_pkg/server/data

# CRITICAL: strip the frontend build scripts from the PACKAGE's package.json.
# With SCM_DO_BUILD_DURING_DEPLOYMENT=true, Oryx runs `npm run build` on the
# server if a `build` script exists. That script is `tsc -b && vite build`, but
# `tsc`/`vite` are devDependencies and NODE_ENV=production makes `npm install`
# skip devDeps → the server build dies with `sh: 1: tsc: not found`. We already
# built dist/ locally (with the VITE_FIREBASE_* vars baked in), so Azure must
# NOT rebuild the frontend — it only needs `npm install` to compile
# better-sqlite3 for Linux. Removing the scripts makes Oryx skip the build.
node -e 'const fs=require("fs"),f="deploy_pkg/package.json",p=JSON.parse(fs.readFileSync(f));for(const k of ["build","build:prod","copy-static"])delete p.scripts[k];fs.writeFileSync(f,JSON.stringify(p,null,2)+"\n")'

cd deploy_pkg && zip -rq ../deploy.zip . && cd ..
```

The zip should be a few hundred KB. If it's multiple MB, `node_modules` snuck in.
Note: `server/.env.example` is a harmless placeholder template and is fine to ship.

### 3. Push to Azure

Deploy with the app **stopped** so Oryx can overwrite `node_modules` without
fighting file locks held by the running process:

```bash
az webapp stop -g glaze-viewer-rg -n glaze-viewer

az webapp deploy \
  -g glaze-viewer-rg \
  -n glaze-viewer \
  --src-path deploy.zip \
  --type zip \
  --track-status false

az webapp start -g glaze-viewer-rg -n glaze-viewer
```

`--track-status false` avoids a spurious CLI hang on the status-polling step.
The CLI may still print a gateway timeout while Azure runs `npm install` — this
is normal. Watch progress with `az webapp log tail`.

**If `az webapp deploy` reports `Status Code: 400 / Deployment Failed`:** the
top-level Oryx summary lies ("0 issues"). The real error is in the child
sub-log. Kudu basic-auth is disabled, so fetch it through ARM:

```bash
sub=$(az account show --query id -o tsv)
did=$(az rest --method get --url "https://management.azure.com/subscriptions/$sub/resourceGroups/glaze-viewer-rg/providers/Microsoft.Web/sites/glaze-viewer/deployments?api-version=2023-12-01" --query "value[0].properties.id" -o tsv)
az rest --method get --url "https://management.azure.com/subscriptions/$sub/resourceGroups/glaze-viewer-rg/providers/Microsoft.Web/sites/glaze-viewer/deployments/$did/log?api-version=2023-12-01"
# then GET .../deployments/$did/log/<entryId> for any entry with a details_url
```

### 4. Verify

```bash
URL=https://glaze-viewer-c4e9ahdnhnffajed.canadacentral-01.azurewebsites.net
curl -I "$URL"                  # expect 200 with X-Powered-By: Express
curl "$URL/api/health"          # expect {"ok":true,...}
curl "$URL/api/config"          # expect JSON
az webapp log tail -g glaze-viewer-rg -n glaze-viewer
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Container exits immediately, log says `ALLOWED_ORIGINS must be set` | Add the env var, then restart. |
| `Cannot find module 'better-sqlite3'` or `ELF header` errors | `node_modules` was bundled. Rebuild package without it and ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true`. |
| `firebase-admin` init fails | `FIREBASE_SERVICE_ACCOUNT` missing or malformed JSON (must be a single line, properly escaped). |
| Deploy 400 and sub-log shows `sh: 1: tsc: not found` | The deploy package still has the `build` script. Oryx ran `npm run build` but devDeps (`tsc`/`vite`) aren't installed under `NODE_ENV=production`. Remove `build`/`build:prod`/`copy-static` from the package's `package.json` (step 2) and redeploy. |
| 404 on every `/api/*` route | Startup file not set; site is serving static only. Re-run the startup-command in the Startup section above. |
| `az webapp deploy` hangs for >5 min | Cancel, check Kudu directly: `https://<scm-url>/api/deployments`. Deploy usually completed in background. |

## Quick Reference

```bash
# App settings
az webapp config appsettings list -g glaze-viewer-rg -n glaze-viewer -o table

# Restart / logs / state
az webapp restart  -g glaze-viewer-rg -n glaze-viewer
az webapp log tail -g glaze-viewer-rg -n glaze-viewer
az webapp show     -g glaze-viewer-rg -n glaze-viewer --query state

# SSH into the running container
az webapp ssh -g glaze-viewer-rg -n glaze-viewer
```

# Fair Ford Pharma — Go-Live Runbook (Render)

One Node process serves both the API (`/api/*`) and the static frontend. No build
step. Deploy target: **Render** (Blueprint in [`render.yaml`](render.yaml)).

---

## 0. Before you deploy — security (do this first)

1. **Rotate the Gmail App Password (`EMAIL_PASS`).** It is the one leaked secret
   that was never rotated. Google Account → Security → 2-Step Verification →
   App passwords → delete the old one, create a new one. Use the new value only in
   Render env vars (never commit it).
2. **Remove the leaked branch on GitHub.** `origin/tushar-product-ui` still contains
   the old committed `.env` in its history. It is orphaned pre-purge history and its
   work is already in `main`, so delete it:
   ```bash
   git push origin --delete tushar-product-ui
   ```
   (`main`, `origin/main`, and `friend/main` are already clean.)
3. Confirm `.env` is **not** committed (it isn't — only `.env.example` is).

---

## 1. Create the Render service

**Option A — Blueprint (recommended):** Render Dashboard → **New → Blueprint** →
connect the GitHub repo → Render reads `render.yaml` and creates the service.

**Option B — Manual:** New → Web Service → connect repo →
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Node version is pinned to 24 via `backend/.node-version`.

## 2. Set environment variables (Render dashboard → Environment)

Everything marked `sync: false` in `render.yaml` must be pasted in by hand:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` (already in blueprint) |
| `FRONTEND_URL` | `https://fairfordpharma.com` (already in blueprint) |
| `MONGO_URI` | Atlas connection string (rotated cluster) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | the strong 96-char secrets |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary |
| `EMAIL_USER` / `EMAIL_PASS` / `ADMIN_EMAIL` | Gmail (use the **new** app password) |

## 3. MongoDB Atlas network access

Render web services use **dynamic outbound IPs**, so add `0.0.0.0/0` to the Atlas
IP access list (safe here — access is still gated by the rotated DB credentials).
Static outbound IPs require a paid Render plan if you later want to lock this down.

## 4. Custom domain (fairfordpharma.com)

Render → Settings → Custom Domains → add both `fairfordpharma.com` and
`www.fairfordpharma.com`. Follow Render's DNS instructions at your registrar
(apex `ALIAS`/`A`, `www` `CNAME`). HTTPS certs are issued automatically.
The app's CORS whitelist and sitemap already expect these two hosts.

## 5. Post-deploy smoke test

- `GET /api/health` → `{ success: true, status: "OK", env: "production" }`
- Home page + product listing load
- Admin login (`/admin.html`) → redirects to `/superadmin.html`
- Retailer login → `/retailer.html`; edit shop address; browse products
- Place a COD order end to end; confirm stock decremented + admin sees it
- Confirm the distributor order-notification email arrives (validates `EMAIL_PASS`)

## Notes

- `npm run seed` / `seed:fresh` seed demo data. The production cluster was already
  migrated with real data — only reseed intentionally (`seed:fresh` WIPES all data).
- Free plan cold-starts after idle; switch `plan: free` → `starter` in `render.yaml`
  (or in the dashboard) for an always-on launch.

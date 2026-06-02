# HG Services Ops Control

Internal marketing operations tool for HG Services' first-month onboarding, task delegation, content pipeline, calendar planning, reporting, and Google Sheet backup.

The project now has two surfaces:

- Password-protected Vercel ops app at `/`
- Partner-safe static summary in `docs/` for GitHub Pages

## What This Includes

- `index.html` - archived partner-safe frontend without database or Google Sheet controls.
- `docs/index.html` - same partner-safe frontend published by GitHub Pages.
- `private/admin.html` - authenticated ops workflow for dashboard, onboarding, tasks, content, calendar, reports, and sync.
- `login.html` - backend login screen.
- `server.js` - password-protected backend and Google Sheet proxy.
- `api/` - Vercel serverless backend routes for login, logout, admin, and Google Sheet sync.
- `lib/vercel-auth.mjs` - signed cookie authentication helpers for Vercel.
- `vercel.json` - Vercel routing for protected `/`, `/admin`, `/login`, and private paths.
- `.vercelignore` - Vercel deployment allowlist so only needed frontend/backend files are uploaded.
- `google-sheet-setup/google-apps-script.gs` - Google Apps Script web app endpoint for syncing the website database to Google Sheets.
- `.env.example` - required backend environment variables.

## Main Workflow

1. Open `/` to sign in and enter the ops command center.
2. Use the left sidebar for Dashboard, Onboarding, Tasks, Content, Calendar, Reports, and Logout.
3. Work through `/admin/onboarding`, `/admin/tasks`, `/admin/content`, `/admin/calendar`, and `/admin/reports`.
4. Configure backend environment variables before using the protected app.
5. Deploy the Apps Script in a Google Sheet.
6. Set `APPS_SCRIPT_URL` on the backend.
7. Use debounced autosave to Google Sheet, plus Pull latest and admin-only backup controls.

## Backend Setup

Create environment variables based on `.env.example`.

For Vercel, add these in Project Settings > Environment Variables:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
OPS_USERNAME=ops
OPS_PASSWORD=replace-with-a-strong-ops-password
SESSION_SECRET=replace-with-a-long-random-secret
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Deploy the repo to Vercel from GitHub. The live Vercel site will then expose:

- Ops login/dashboard: `https://your-project.vercel.app/`
- Admin dashboard route: `https://your-project.vercel.app/admin`
- Ops pages: `/admin/onboarding`, `/admin/tasks`, `/admin/content`, `/admin/calendar`, `/admin/reports`

For local Node testing without Vercel, you can still run:

```bash
npm start
```

Then open:

- Ops login/dashboard: `http://127.0.0.1:3000/`
- Admin dashboard route: `http://127.0.0.1:3000/admin`

## Google Sheet Setup

1. Create or open a Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Paste the contents of `google-sheet-setup/google-apps-script.gs`.
4. Run `setupSheet` once to create `Tasks`, `Content`, `Calendar`, `Channels`, `Reports`, `Settings`, and `Sync Log`.
5. Deploy as a Web App:
   - Execute as: `Me`
   - Access: `Anyone with the link`
6. Add the web app URL as backend environment variable `APPS_SCRIPT_URL`.

## Notes

- The Vercel root is protected and prompts login immediately.
- The GitHub Pages/static frontend hides database and sync controls.
- Admin and Ops roles require backend login through Vercel functions or `server.js`.
- Admin can use backup/import/clear controls; Ops can update workflow data.
- No Google credentials or Apps Script URL are stored in the frontend HTML.
- The Google Sheet acts as backup, reporting database, and recovery source.
- GitHub Pages is configured to publish from `docs/` so backend files are not served by the live static site.
- Use Vercel as the main deployment when you want frontend and backend on one public URL.

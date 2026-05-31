# HG Services June Launch Control

Internal marketing launch tracker for HG Services' first-month marketing foundation work.

The project now has two surfaces:

- Partner-safe frontend at `/`
- Password-protected admin/backend at `/admin`

## What This Includes

- `index.html` - partner-safe frontend without database or Google Sheet controls.
- `private/admin.html` - admin dashboard with database tools and Google Sheet sync buttons.
- `login.html` - backend login screen.
- `server.js` - password-protected backend and Google Sheet proxy.
- `google-sheet-setup/google-apps-script.gs` - Google Apps Script web app endpoint for syncing the website database to Google Sheets.
- `.env.example` - required backend environment variables.

## Main Workflow

1. Share `/` with a partner for the tracker view without backend controls.
2. Use `/admin` for database tools, backup, and Google Sheet sync.
3. Configure backend environment variables before using `/admin`.
4. Deploy the Apps Script in a Google Sheet.
5. Set `APPS_SCRIPT_URL` on the backend.
6. Use Push to Google Sheet and Pull from Google Sheet from the admin page.

## Backend Setup

Create environment variables based on `.env.example`:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
SESSION_SECRET=replace-with-a-long-random-secret
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
PORT=3000
```

Run locally:

```bash
npm start
```

Then open:

- Partner view: `http://127.0.0.1:3000/`
- Admin view: `http://127.0.0.1:3000/admin`

## Google Sheet Setup

1. Create or open a Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Paste the contents of `google-sheet-setup/google-apps-script.gs`.
4. Run `setupSheet` once.
5. Deploy as a Web App:
   - Execute as: `Me`
   - Access: `Anyone with the link`
6. Add the web app URL as backend environment variable `APPS_SCRIPT_URL`.

## Notes

- The partner frontend hides database and sync controls.
- The admin page requires backend login.
- No Google credentials or Apps Script URL are stored in the frontend HTML.
- The Google Sheet acts as backup, reporting database, and recovery source.
- GitHub Pages can only serve the partner-safe static frontend. Use a Node-capable host for the protected backend.

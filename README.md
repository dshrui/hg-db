# HG Services June Launch Control

Internal marketing launch tracker for HG Services' first-month marketing foundation work.

## What This Includes

- `index.html` - standalone browser dashboard for checklist tracking, June planning, channel setup, content production, and local database storage.
- `google-sheet-setup/google-apps-script.gs` - Google Apps Script web app endpoint for syncing the website database to Google Sheets.

## Main Workflow

1. Open `index.html` in a browser.
2. Use the checklist, channel matrix, content production board, and June calendar as the working tracker.
3. Save locally or export JSON as a backup.
4. Deploy the Apps Script in a Google Sheet.
5. Paste the Apps Script web app URL into the Google Sheet Sync section.
6. Use Push to Google Sheet and Pull from Google Sheet to sync.

## Google Sheet Setup

1. Create or open a Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Paste the contents of `google-sheet-setup/google-apps-script.gs`.
4. Run `setupSheet` once.
5. Deploy as a Web App:
   - Execute as: `Me`
   - Access: `Anyone with the link`
6. Copy the web app URL into the website.

## Notes

- The website is designed for internal use first.
- No Google credentials are stored in the HTML.
- The Google Sheet acts as backup, reporting database, and recovery source.

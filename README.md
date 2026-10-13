# Shared Shift Crew Planner

The completed shared site preserves the familiar store/goal/crew/roles/preview workflow, with automatic recalculation, persistent settings/forecasts, scenario controls, constrained two-store assignment and honest diagnostics. The Schedule Board and all related functionality were removed at the user’s explicit request. It uses the existing Firebase Google/client-email interface gate. Static employee names and derived planning data remain publicly downloadable; the gate is not data authorization.

Local administration: `StartLocalSite.cmd`. After importing production history, run `BuildWeeklyPages.cmd`, review the generated allowlist, then commit and push **only** `pages_repository`. Its Pages workflow publishes main pushes automatically. See [PAGES_WEEKLY_GUIDE.txt](PAGES_WEEKLY_GUIDE.txt) for exact root/remote checks, preview, semantics, exposed fields and recovery instructions.

Do not publish this parent repository or its Git history; it contains private source evidence. The clean publishing folder contains 61 current employees and all 856 store choices (including labelled original-reference fallbacks). Former identities, raw workbooks, attendance rows, databases and backups stay local. The frozen model has no new accuracy claim.

The Firebase CSP loader defect has been corrected; localhost, 127.0.0.1 and the Pages host were confirmed authorized by a read-only SDK configuration query. A completed real-account Google popup remains a user check. No provider settings or grants changed.


---

Original React application setup retained for reference (not required for the shared planner):

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

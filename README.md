# Crestwood School Ledger

A school management system for Ugandan schools: student admissions, class fees,
fee payments with QR receipts, defaulters, staff payroll, expenses and owner
approvals — all in UGX — with separate dashboards for the **School Owner**,
**Head Teacher**, **Bursar** and **Academic Registrar**.

**Open it:** https://kaniwe-timothy.github.io/school-management-system/

## How it works

The whole app is a single HTML page. There is no server and no monthly cost:

- The first person to open it creates the **School Owner** account, then adds
  logins for the Head Teacher, Bursar and Registrar from the Owner dashboard.
- Everything is saved **in the browser on that device** (localStorage). Records
  are not shared between phones or computers automatically.
- Use **School Name & Backup** on the Owner dashboard to download a backup
  file, and restore it on another device. Clearing the browser's site data
  deletes the records, so keep backups.

You can also save the page as `School Management System.html` and
open it straight from a phone or computer — it works offline (fonts fall back
to system fonts without internet).

## Develop

```bash
npm install
npm run dev     # local dev server
npm run build   # writes one self-contained file: dist/index.html
```

`src/localApi.ts` stands in for the original Express/SQLite server: the
components still call `fetch('/api/...')`, and it answers those calls from
browser storage with the same validation and role rules.

Pushing to `main` rebuilds and publishes the site through GitHub Pages
(`.github/workflows/deploy.yml`).

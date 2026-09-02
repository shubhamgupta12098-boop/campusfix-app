# Admin Reports Functional Update

Updated the Admin Reports & Analytics experience requested on 2026-09-02.

## Changes
- Added live Total / Open / In Progress / Closed complaint counts.
- Status cards are buttons and filter the complaint charts when tapped.
- Added a real date-range control using From / To calendar inputs, plus Last 30 days and All time shortcuts.
- Removed visible Reopened and Resolved metrics/labels from the reports UI.
- Added a reference-style category donut chart with purple, blue, green and orange colors.
- Added a reference-style monthly trend chart.
- Added horizontal Staff Performance bars and a yellow Average Rating star.
- Replaced the Admin header notification bell with a circular + shortcut.
- The + shortcut opens a My Jobs view backed by the existing Work Orders screen.
- CSV export respects the selected date range and active status filter.

## Run locally
```bash
npm install
npm run build
npm start
```
Open: http://localhost:3000/admin/

For Admin-only Vite development:
```bash
npm install
npm run dev:admin
```

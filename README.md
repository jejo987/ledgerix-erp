# Ledgerix ERP

From *ledger* (a record of business transactions) + the tech-style suffix
*-ix*, reflecting the system's core purpose: keeping accurate, centralized
records of inventory, sales, purchasing, and staff across the business.

A fully functional ERP system: a Node.js/Express backend with a real REST
API, backed by **Firebase Firestore** (a real cloud database), with a front
end that talks to it live.

## What "fully functional" means here

- **Front end** — `public/index.html`, `styles.css`, `app.js`
- **Back end** — Express server (`server.js`) exposing a REST API
- **Database** — Firebase Firestore, Google's cloud NoSQL database. Data is
  stored in the cloud, not on your laptop — it survives server restarts,
  redeploys, and even a totally fresh `git clone` on another machine.
- **Working CRUD** — the Add / Edit / Delete buttons in every module
  (Inventory, Sales, Purchasing, HR) actually call the API and persist
  changes to Firestore
- **Live dashboard** — the summary cards and charts are computed from the
  real current data, not hardcoded numbers

## Requirements

- [Node.js](https://nodejs.org) installed (version 18 or newer recommended)
- A free [Firebase](https://firebase.google.com) account (just needs a
  Google account — no credit card required for the free Spark plan)

## One-time Firebase setup (do this before running the app)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and click **Add project**. Name it anything (e.g. "ledgerix-erp"). You can
   skip Google Analytics — it's not needed.
2. Once inside the project, go to **Build → Firestore Database** in the left
   sidebar, then click **Create database**.
   - Choose a location close to you and click Next.
   - Select **Start in test mode** (this allows read/write access for 30
     days, which is plenty for a school project — you can tighten security
     rules later if needed).
3. Now generate your credentials: click the **gear icon** (top-left, next to
   "Project Overview") → **Project settings** → **Service accounts** tab.
4. Click **Generate new private key**. This downloads a `.json` file —
   rename it to exactly:
   ```
   serviceAccountKey.json
   ```
   and place it in this project's root folder (the same folder as
   `server.js`).

   ⚠️ **Never share this file or commit it to GitHub** — it's your
   database's password, essentially. It's already listed in `.gitignore` so
   Git won't accidentally track it.

## How to run it

1. Open a terminal in this folder
2. Install dependencies (only needs to be done once):
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
   The first time you run this against a brand-new Firebase project, the
   server automatically loads sample data into Firestore for you (you'll see
   a "Firestore looks empty — loading seed data..." message in the
   terminal).
4. Open your browser to:
   ```
   http://localhost:3000
   ```

## Project structure

```
ledgerix-erp/
├── server.js               Express server + REST API routes
├── db.js                   Firestore read/write/seed helpers
├── reports.js              Date-range logic + CSV/PDF report builders
├── serviceAccountKey.json  YOUR Firebase credentials (you add this — not included)
├── package.json
└── public/                 the front end, served as static files
    ├── index.html
    ├── styles.css
    └── app.js                fetches from /api/... (unchanged by the Firebase switch)
```

## API reference

All endpoints return/accept JSON.

| Method | Endpoint                    | Description                        |
|--------|------------------------------|-------------------------------------|
| GET    | `/api/inventory`             | List all inventory items            |
| POST   | `/api/inventory`             | Create a new inventory item         |
| PUT    | `/api/inventory/:id`         | Update an inventory item            |
| DELETE | `/api/inventory/:id`         | Delete an inventory item            |
| GET/POST/PUT/DELETE | `/api/sales`, `/api/purchasing`, `/api/hr` | Same pattern for each module |
| GET    | `/api/dashboard/summary`     | Live totals used by the Dashboard   |
| POST   | `/api/reset`                 | Wipes Firestore and reloads the original seed/sample data (handy before a demo) |

## Resetting your data before a demo/defense

If your data gets messy while testing, call the reset endpoint:

```
curl -X POST http://localhost:3000/api/reset
```

This deletes everything in Firestore and reloads the original sample data.

## Viewing your data directly (optional, good for a demo)

Since your data is in Firestore, you can open the **Firebase Console →
Firestore Database** tab in your browser at any time to see the raw
documents update live as you use the app. This can be a nice thing to show
during a defense — proof the data is really in the cloud, not just in the
browser.

## Deploying to the cloud (e.g. Render)

Because your data now lives in Firestore instead of a local file, you don't
have Render's "filesystem resets on sleep" problem anymore — your data
persists in the cloud regardless of what your Render server does.

`db.js` already supports this: on the cloud it reads your Firebase key from
the `FIREBASE_SERVICE_ACCOUNT` environment variable, and on your laptop it
reads `serviceAccountKey.json`. The key file itself never goes to GitHub
(it is listed in `.gitignore`).

### Steps

1. **Push the project to GitHub** (a new repo). Check first that
   `serviceAccountKey.json` and `node_modules` do NOT appear in the list of
   files to be committed.
2. On [render.com](https://render.com) sign in with GitHub, then
   **New > Web Service** and pick the repo.
3. Settings: **Runtime** Node, **Build Command** `npm install`,
   **Start Command** `npm start`, **Instance Type** Free.
4. Under **Environment Variables** add:
   - Key: `FIREBASE_SERVICE_ACCOUNT`
   - Value: the entire contents of `serviceAccountKey.json` (open it in
     VS Code, select all, copy, paste; it starts with `{` and ends with `}`)
5. Click **Create Web Service**. After a few minutes Render gives you a URL
   like `https://ledgerix-erp.onrender.com`.

The free plan sleeps after about 15 minutes without visitors, so the first
page load afterwards takes 30-60 seconds. Open the URL a minute before a
demo to wake it up. Your data is not affected, because it lives in
Firestore.

## Notes for your defense/presentation

- **Front end / Back end / Database, all present**: `public/` (front end),
  `server.js` (back end / REST API), Firestore (database) — a real 3-tier
  architecture.
- Every module (Inventory, Sales, Purchasing, HR) follows the exact same
  CRUD pattern in `server.js`, generated by a loop — this demonstrates you
  understand REST API design, not just one hardcoded example.
- Firestore is a **NoSQL document database** (data stored as JSON-like
  documents in collections), not a relational SQL database like MySQL. If
  asked, you can explain: instead of rows/columns/foreign keys, Firestore
  organizes data into *collections* (like `inventory`, `sales`) containing
  *documents* (like each individual item), which is a very common modern
  choice for web apps needing quick, flexible cloud storage.
- The Sales Trend chart on the Dashboard mixes a few months of illustrative
  historical data with your one real live month, since the system just
  "launched" — mention this if asked, it's a normal thing to flag in a demo.

## Sales and Inventory are connected (stock deduction)

Recording a sale now needs an **Item Sold** (picked from Inventory) and a **Quantity Sold**. In one Firestore transaction the server:

- subtracts the quantity from the item's stock and updates its status (0 = Out of Stock, 20 or fewer = Low Stock, otherwise In Stock);
- rejects the sale if there is not enough stock (`400 Only N of <item> in stock`);
- puts the stock back when the sale is set to **Cancelled** or deleted, and takes it again if a Cancelled sale is re-opened.

Item and quantity are fixed after the sale is saved. Older seed orders have no item, so they do not touch stock.

## Changes after teacher feedback (October 2026)

| Module | Change |
|--------|--------|
| Dashboard | Range selector: **Monthly / Quarterly / Annually** with a slider (months 1-12, quarters 1-4, or the available years). Sales total, order count, pending purchase orders and the sales chart follow the selected period. Inventory and low-stock cards are always the current stock. |
| Inventory | No changes |
| Sales | Customer, total and status are required (never empty). The date is set automatically by the server on save and cannot be edited. |
| Purchasing | Same rules: supplier, total and status required, date automatic. |
| Employee (was HR) | Sidebar/page now say **Employee**; column headers are **Employee** and **Employee Status**. |
| Reports | Same range selector, plus **Download PDF** and **Download CSV** for the selected period (summary, sales, purchase orders, inventory, employees). |

New / changed endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary?period=monthly&year=2026&n=8` | `period` is `monthly`, `quarterly` or `annual`; `n` is the month (1-12) or quarter (1-4). No parameters = latest month with sales. |
| GET | `/api/reports/download?format=pdf&period=quarterly&year=2026&n=3` | Downloads the report as `pdf` or `csv` |
| POST | `/api/sales`, `/api/purchasing` | Returns `400 {"error": "..."}` if a required field is missing; the `date` is added by the server |

After pulling these changes run `npm install` once (adds `pdfkit` for the PDF export).

**Sample data:** the seed data now spans Nov 2025 - Oct 2026 so the ranges have something to show. To load it into a Firestore that already has the old sample data, run this in PowerShell while the server is running (this wipes the current records):

```
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/reset
```

// server.js
// Express backend for the Ledgerix ERP. Serves the front end from /public
// and exposes a REST API under /api/* backed by Firebase Firestore
// (see db.js). Every Add / Edit / Delete in the browser calls one of these
// routes, which reads/writes real documents in your Firestore database.

const express = require("express");
const path = require("path");
const {
  ensureSeeded,
  getAll,
  createRecord,
  updateRecord,
  deleteRecord,
  resetToSeed,
} = require("./db");
const {
  todayISO,
  resolveRange,
  getMeta,
  buildReportData,
  buildCsv,
  buildPdf,
} = require("./reports");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const COLLECTIONS = ["inventory", "sales", "purchasing", "hr"];

/* ---------------------------------------------------------
   Validation for Sales and Purchasing
   - customer / supplier, total and status are required (never null/empty)
   - the date is NOT accepted from the client: the server stamps today's
     date when a record is created and it can't be changed afterwards
--------------------------------------------------------- */
const RULES = {
  sales: {
    textField: { key: "customer", label: "Customer" },
    statuses: ["Pending", "Completed", "Cancelled"],
  },
  purchasing: {
    textField: { key: "supplier", label: "Supplier" },
    statuses: ["Pending", "In Transit", "Received"],
  },
};

// Returns { data } with the cleaned fields, or { error } with a message.
// On create every field is required; on update only the fields that are
// sent are checked (and they still can't be empty).
function cleanPayload(key, body, isUpdate) {
  const rule = RULES[key];
  const input = body || {};
  const data = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);

  const { key: textKey, label: textLabel } = rule.textField;
  if (!isUpdate || has(textKey)) {
    const text = typeof input[textKey] === "string" ? input[textKey].trim() : "";
    if (!text) return { error: `${textLabel} is required` };
    data[textKey] = text;
  }

  if (!isUpdate || has("total")) {
    const total = input.total === "" || input.total == null ? NaN : Number(input.total);
    if (!Number.isFinite(total) || total <= 0) return { error: "Total must be a number greater than 0" };
    data.total = total;
  }

  if (!isUpdate || has("status")) {
    if (!rule.statuses.includes(input.status)) return { error: "Status is required" };
    data.status = input.status;
  }

  return { data };
}

/* ---------------------------------------------------------
   Generic CRUD routes for each collection
   GET    /api/:collection        -> list all records
   POST   /api/:collection        -> create a record
   PUT    /api/:collection/:id    -> update a record
   DELETE /api/:collection/:id    -> delete a record
--------------------------------------------------------- */
COLLECTIONS.forEach((key) => {
  const base = `/api/${key}`;
  const validated = Boolean(RULES[key]);

  app.get(base, async (req, res) => {
    try {
      res.json(await getAll(key));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load data from Firestore" });
    }
  });

  app.post(base, async (req, res) => {
    try {
      let payload = req.body || {};
      if (validated) {
        const { data, error } = cleanPayload(key, payload, false);
        if (error) return res.status(400).json({ error });
        payload = { ...data, date: todayISO() }; // automatic date
      }
      const record = await createRecord(key, payload);
      res.status(201).json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create record" });
    }
  });

  app.put(`${base}/:id`, async (req, res) => {
    try {
      let payload = req.body || {};
      if (validated) {
        const { data, error } = cleanPayload(key, payload, true);
        if (error) return res.status(400).json({ error });
        payload = data; // date is never overwritten
      }
      const updated = await updateRecord(key, req.params.id, payload);
      if (!updated) return res.status(404).json({ error: "Record not found" });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update record" });
    }
  });

  app.delete(`${base}/:id`, async (req, res) => {
    try {
      const ok = await deleteRecord(key, req.params.id);
      if (!ok) return res.status(404).json({ error: "Record not found" });
      res.status(204).end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });
});

/* ---------------------------------------------------------
   Dashboard summary for a selected range
   GET /api/dashboard/summary?period=monthly|quarterly|annual&year=2026&n=8
     monthly   -> n is the month (1-12)
     quarterly -> n is the quarter (1-4)
     annual    -> n is ignored (the year is the range)
   With no parameters it opens on the latest month that has sales.
--------------------------------------------------------- */
async function loadAll() {
  const [inventory, sales, purchasing, hr] = await Promise.all([
    getAll("inventory"),
    getAll("sales"),
    getAll("purchasing"),
    getAll("hr"),
  ]);
  return { inventory, sales, purchasing, hr };
}

app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const data = await loadAll();
    const range = resolveRange(req.query, data);
    res.json({ ...buildReportData(data, range).summary, meta: getMeta(data) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to compute dashboard summary" });
  }
});

/* ---------------------------------------------------------
   Downloadable report for the selected range
   GET /api/reports/download?format=pdf|csv&period=...&year=...&n=...
--------------------------------------------------------- */
app.get("/api/reports/download", async (req, res) => {
  try {
    const data = await loadAll();
    const range = resolveRange(req.query, data);
    const format = req.query.format === "pdf" ? "pdf" : "csv";
    const filename = `ledgerix-report-${range.slug}.${format}`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      buildPdf(data, range, res);
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(buildCsv(data, range));
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to build the report" });
  }
});

/* ---------------------------------------------------------
   Reset endpoint — restores original seed data (handy for demos)
--------------------------------------------------------- */
app.post("/api/reset", async (req, res) => {
  try {
    const db = await resetToSeed();
    res.json({ message: "Database reset to seed data", db });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset database" });
  }
});

/* ---------------------------------------------------------
   Startup — make sure Firestore has sample data the first time
   this ever runs against a brand-new Firebase project
--------------------------------------------------------- */
ensureSeeded()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Ledgerix ERP server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to Firestore on startup:", err.message);
    process.exit(1);
  });

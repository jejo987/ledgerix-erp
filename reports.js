// reports.js
// Pure helper functions (no Firestore, no Express) for everything that
// depends on a date range: the dashboard summary, the CSV export and the
// PDF export. Keeping them separate from server.js makes them easy to test
// and easy to explain in a defense.
//
// A "range" is one of:
//   monthly    -> one calendar month   (e.g. August 2026)
//   quarterly  -> one calendar quarter (e.g. Q3 2026 = Jul-Sep)
//   annual     -> one calendar year    (e.g. 2026)

const PDFDocument = require("pdfkit");

const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const pad = (n) => String(n).padStart(2, "0");
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const daysInMonth = (year, month) => new Date(year, month, 0).getDate(); // month is 1-12

/* ---------------------------------------------------------
   Dates
--------------------------------------------------------- */

// Today's date as YYYY-MM-DD in the business timezone. Sales and purchase
// orders get this stamped on them by the server, so the date can never be
// empty and never depends on what the browser sends.
function todayISO() {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10);
}

/* ---------------------------------------------------------
   Ranges
--------------------------------------------------------- */

function getRange(period, year, n) {
  year = Math.round(Number(year));
  n = Math.round(Number(n));

  if (String(period).startsWith("annual")) {
    return {
      period: "annual",
      year,
      n: year,
      label: String(year),
      slug: String(year),
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      bucketBy: "month",
      firstMonth: 1,
      labels: MONTHS_SHORT.slice(),
    };
  }

  if (period === "quarterly") {
    const q = clamp(n, 1, 4);
    const first = (q - 1) * 3 + 1;
    const last = q * 3;
    return {
      period: "quarterly",
      year,
      n: q,
      label: `Q${q} ${year}`,
      slug: `${year}-Q${q}`,
      start: `${year}-${pad(first)}-01`,
      end: `${year}-${pad(last)}-${pad(daysInMonth(year, last))}`,
      bucketBy: "month",
      firstMonth: first,
      labels: MONTHS_SHORT.slice(first - 1, last),
    };
  }

  const month = clamp(n, 1, 12);
  const dim = daysInMonth(year, month);
  return {
    period: "monthly",
    year,
    n: month,
    label: `${MONTHS[month - 1]} ${year}`,
    slug: `${year}-${pad(month)}`,
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(dim)}`,
    bucketBy: "day",
    firstMonth: month,
    labels: Array.from({ length: dim }, (_, i) => String(i + 1)),
  };
}

const inRange = (dateStr, range) =>
  typeof dateStr === "string" && dateStr >= range.start && dateStr <= range.end;

// Which chart bucket (day or month) a date belongs to
function bucketIndex(dateStr, range) {
  if (range.bucketBy === "day") return Number(dateStr.slice(8, 10)) - 1;
  return Number(dateStr.slice(5, 7)) - range.firstMonth;
}

// Years that actually have data (plus the current year), used to size the
// slider when "Annually" is selected, and the latest month with a sale so
// the dashboard opens on something that has data in it.
function getMeta(data) {
  const dates = [...data.sales, ...data.purchasing]
    .map((r) => r.date)
    .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d));
  const thisYear = Number(todayISO().slice(0, 4));
  const years = dates.map((d) => Number(d.slice(0, 4))).concat(thisYear);
  return { minYear: Math.min(...years), maxYear: Math.max(...years) };
}

function defaultRange(data) {
  const saleDates = data.sales
    .map((s) => s.date)
    .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d))
    .sort();
  const latest = saleDates.length ? saleDates[saleDates.length - 1] : todayISO();
  return getRange("monthly", Number(latest.slice(0, 4)), Number(latest.slice(5, 7)));
}

// Turn ?period=&year=&n= into a range, falling back to the default if the
// parameters are missing or nonsense.
function resolveRange(query, data) {
  const period = String(query.period || "");
  const year = Number(query.year);
  const n = Number(query.n);
  const validPeriod = ["monthly", "quarterly", "annual", "annually"].includes(period);
  if (!validPeriod || !Number.isInteger(year) || year < 1970 || year > 2200) {
    return defaultRange(data);
  }
  return getRange(period, year, Number.isFinite(n) ? n : 1);
}

/* ---------------------------------------------------------
   Report data
--------------------------------------------------------- */

const sumOf = (rows) => rows.reduce((t, r) => t + Number(r.total || 0), 0);
const byDateThenId = (a, b) => (a.date || "").localeCompare(b.date || "") || a.id.localeCompare(b.id);

function buildReportData(data, range) {
  const salesRows = data.sales.filter((s) => inRange(s.date, range)).sort(byDateThenId);
  const purchaseRows = data.purchasing.filter((p) => inRange(p.date, range)).sort(byDateThenId);

  const counted = salesRows.filter((s) => s.status !== "Cancelled");
  const values = range.labels.map(() => 0);
  counted.forEach((s) => {
    const i = bucketIndex(s.date, range);
    if (i >= 0 && i < values.length) values[i] += Number(s.total || 0);
  });

  const stockByCategory = {};
  data.inventory.forEach((i) => {
    stockByCategory[i.category] = (stockByCategory[i.category] || 0) + Number(i.qty || 0);
  });

  const count = (rows, status) => rows.filter((r) => r.status === status).length;

  const summary = {
    range: {
      period: range.period,
      year: range.year,
      n: range.n,
      label: range.label,
      slug: range.slug,
      start: range.start,
      end: range.end,
      bucketBy: range.bucketBy,
    },
    // time-based (follow the selected range)
    totalSales: sumOf(counted),
    orderCount: salesRows.length,
    completedOrders: count(salesRows, "Completed"),
    pendingOrders: count(salesRows, "Pending"),
    cancelledOrders: count(salesRows, "Cancelled"),
    purchaseSpend: sumOf(purchaseRows),
    poCount: purchaseRows.length,
    pendingPOs: count(purchaseRows, "Pending"),
    series: { labels: range.labels, values },
    // snapshots (current state, not date-based)
    totalInventoryUnits: data.inventory.reduce((t, i) => t + Number(i.qty || 0), 0),
    lowStockCount: data.inventory.filter((i) => i.status === "Low Stock" || i.status === "Out of Stock").length,
    stockByCategory: Object.entries(stockByCategory).map(([name, value]) => ({ name, value })),
    employeeCount: data.hr.length,
    activeEmployees: count(data.hr, "Active"),
    employeesOnLeave: count(data.hr, "On Leave"),
  };

  const inventory = data.inventory.slice().sort((a, b) => a.id.localeCompare(b.id));
  const employees = data.hr.slice().sort((a, b) => a.id.localeCompare(b.id));

  return { summary, salesRows, purchaseRows, inventory, employees };
}

/* ---------------------------------------------------------
   CSV export (opens in Excel)
--------------------------------------------------------- */

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells) => cells.map(csvCell).join(",");

function buildCsv(data, range) {
  const { summary: s, salesRows, purchaseRows, inventory, employees } = buildReportData(data, range);
  const lines = [];

  lines.push(csvRow(["Ledgerix Business Report"]));
  lines.push(csvRow(["Period", s.range.label, "From", s.range.start, "To", s.range.end]));
  lines.push(csvRow(["Generated", todayISO()]));
  lines.push("");

  lines.push(csvRow(["SUMMARY"]));
  lines.push(csvRow(["Metric", "Value"]));
  [
    ["Total sales (PHP, excludes cancelled)", s.totalSales],
    ["Orders", s.orderCount],
    ["  Completed", s.completedOrders],
    ["  Pending", s.pendingOrders],
    ["  Cancelled", s.cancelledOrders],
    ["Purchase spend (PHP)", s.purchaseSpend],
    ["Purchase orders", s.poCount],
    ["  Pending", s.pendingPOs],
    ["Inventory units in stock (current)", s.totalInventoryUnits],
    ["Low / out of stock items (current)", s.lowStockCount],
    ["Employees (current)", s.employeeCount],
    ["  Active", s.activeEmployees],
    ["  On Leave", s.employeesOnLeave],
  ].forEach((r) => lines.push(csvRow(r)));
  lines.push("");

  lines.push(csvRow([`SALES - ${s.range.label}`]));
  lines.push(csvRow(["Order ID", "Customer", "Date", "Total (PHP)", "Status"]));
  salesRows.forEach((r) => lines.push(csvRow([r.id, r.customer, r.date, r.total, r.status])));
  lines.push("");

  lines.push(csvRow([`PURCHASE ORDERS - ${s.range.label}`]));
  lines.push(csvRow(["PO Number", "Supplier", "Date", "Total (PHP)", "Status"]));
  purchaseRows.forEach((r) => lines.push(csvRow([r.id, r.supplier, r.date, r.total, r.status])));
  lines.push("");

  lines.push(csvRow(["INVENTORY (current stock)"]));
  lines.push(csvRow(["SKU", "Item Name", "Category", "Qty", "Unit Price (PHP)", "Status"]));
  inventory.forEach((r) => lines.push(csvRow([r.id, r.name, r.category, r.qty, r.price, r.status])));
  lines.push("");

  lines.push(csvRow(["EMPLOYEES (current)"]));
  lines.push(csvRow(["Employee ID", "Employee", "Position", "Department", "Employee Status"]));
  employees.forEach((r) => lines.push(csvRow([r.id, r.name, r.position, r.dept, r.status])));

  // BOM so Excel reads the file as UTF-8
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* ---------------------------------------------------------
   PDF export
--------------------------------------------------------- */

const TEAL = "#22463F";
const INK = "#1B241F";
const MUTED = "#66756D";
const LINE = "#E2E6E2";

// pdfkit's built-in fonts have no peso sign, so amounts print as "PHP 1,234"
const money = (n) =>
  "PHP " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fit(doc, text, maxWidth) {
  if (doc.widthOfString(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(t + "...") > maxWidth) t = t.slice(0, -1);
  return t + "...";
}

function drawTable(doc, { title, note, columns, rows, emptyText }) {
  const left = doc.page.margins.left;
  const width = columns.reduce((t, c) => t + c.w, 0);
  const rowH = 20;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  let y = doc.y + 10;
  if (y + 24 + rowH * 3 > bottom()) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(title, left, y, { lineBreak: false });
  y += 18;
  if (note) {
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(note, left, y, { lineBreak: false });
    y += 12;
  }

  const drawHeader = () => {
    doc.rect(left, y, width, rowH).fill("#F0F2EF");
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    let x = left;
    columns.forEach((c) => {
      doc.text(c.label.toUpperCase(), x + 6, y + 6, { width: c.w - 12, align: c.align || "left", lineBreak: false });
      x += c.w;
    });
    y += rowH;
  };
  drawHeader();

  if (!rows.length) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(emptyText, left + 6, y + 6, { lineBreak: false });
    y += rowH;
  }

  rows.forEach((row, i) => {
    if (y + rowH > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    if (i % 2 === 1) doc.rect(left, y, width, rowH).fill("#FAFBFA");
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    let x = left;
    columns.forEach((c) => {
      const raw = c.format ? c.format(row[c.key], row) : row[c.key];
      const text = fit(doc, String(raw == null ? "" : raw), c.w - 12);
      doc.text(text, x + 6, y + 6, { width: c.w - 12, align: c.align || "left", lineBreak: false });
      x += c.w;
    });
    doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
    y += rowH;
  });

  doc.x = left;
  doc.y = y + 6;
}

function buildPdf(data, range, out) {
  const { summary: s, salesRows, purchaseRows, inventory, employees } = buildReportData(data, range);

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
    info: { Title: `Ledgerix Report - ${s.range.label}`, Author: "Ledgerix ERP" },
  });
  doc.pipe(out);

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  // Header band
  doc.rect(left, 40, width, 62).fill(TEAL);
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#FFFFFF").text("Ledgerix", left + 18, 54, { lineBreak: false });
  doc.font("Helvetica").fontSize(11).fillColor("#D9E0DB").text(`Business Report  |  ${s.range.label}`, left + 18, 78, { lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor("#D9E0DB").text(`Generated ${todayISO()}`, left, 56, { width: width - 18, align: "right", lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor("#D9E0DB").text(`${s.range.start}  to  ${s.range.end}`, left, 70, { width: width - 18, align: "right", lineBreak: false });

  // Summary cards (3 per row)
  const cards = [
    ["Total sales", money(s.totalSales), `${s.orderCount} orders (${s.cancelledOrders} cancelled)`],
    ["Purchase spend", money(s.purchaseSpend), `${s.poCount} purchase orders`],
    ["Pending orders", String(s.pendingOrders), `${s.pendingPOs} pending purchase orders`],
    ["Units in stock", s.totalInventoryUnits.toLocaleString("en-US"), "current"],
    ["Low / out of stock", String(s.lowStockCount), "items, current"],
    ["Employees", String(s.employeeCount), `${s.activeEmployees} active, ${s.employeesOnLeave} on leave`],
  ];
  const gap = 10;
  const cardW = (width - gap * 2) / 3;
  const cardH = 58;
  let cy = 118;
  cards.forEach((c, i) => {
    const cx = left + (i % 3) * (cardW + gap);
    if (i > 0 && i % 3 === 0) cy += cardH + gap;
    doc.roundedRect(cx, cy, cardW, cardH, 6).lineWidth(0.75).strokeColor(LINE).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED).text(c[0].toUpperCase(), cx + 10, cy + 9, { width: cardW - 20, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(c[1], cx + 10, cy + 21, { width: cardW - 20, lineBreak: false });
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(c[2], cx + 10, cy + 42, { width: cardW - 20, lineBreak: false });
  });
  doc.x = left;
  doc.y = cy + cardH + 4;

  drawTable(doc, {
    title: `Sales - ${s.range.label}`,
    note: "Total sales above excludes cancelled orders.",
    emptyText: "No sales recorded in this period.",
    rows: salesRows,
    columns: [
      { key: "id", label: "Order ID", w: 70 },
      { key: "customer", label: "Customer", w: 195 },
      { key: "date", label: "Date", w: 80 },
      { key: "total", label: "Total", w: 95, align: "right", format: money },
      { key: "status", label: "Status", w: 75 },
    ],
  });

  drawTable(doc, {
    title: `Purchase orders - ${s.range.label}`,
    emptyText: "No purchase orders in this period.",
    rows: purchaseRows,
    columns: [
      { key: "id", label: "PO Number", w: 70 },
      { key: "supplier", label: "Supplier", w: 195 },
      { key: "date", label: "Date", w: 80 },
      { key: "total", label: "Total", w: 95, align: "right", format: money },
      { key: "status", label: "Status", w: 75 },
    ],
  });

  drawTable(doc, {
    title: "Inventory (current stock)",
    note: "Stock levels are a live snapshot and do not change with the selected period.",
    emptyText: "No inventory items.",
    rows: inventory,
    columns: [
      { key: "id", label: "SKU", w: 65 },
      { key: "name", label: "Item", w: 165 },
      { key: "category", label: "Category", w: 100 },
      { key: "qty", label: "Qty", w: 45, align: "right" },
      { key: "price", label: "Unit Price", w: 70, align: "right", format: money },
      { key: "status", label: "Status", w: 70 },
    ],
  });

  drawTable(doc, {
    title: "Employees (current)",
    emptyText: "No employees.",
    rows: employees,
    columns: [
      { key: "id", label: "Employee ID", w: 70 },
      { key: "name", label: "Employee", w: 125 },
      { key: "position", label: "Position", w: 120 },
      { key: "dept", label: "Department", w: 100 },
      { key: "status", label: "Employee Status", w: 100 },
    ],
  });

  // Page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // otherwise writing in the margin adds a blank page
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
      `Ledgerix ERP  |  Page ${i + 1} of ${pages.count}`,
      left, doc.page.height - 28, { width, align: "center", lineBreak: false }
    );
    doc.page.margins.bottom = oldBottom;
  }

  doc.end();
}

module.exports = {
  todayISO,
  getRange,
  resolveRange,
  getMeta,
  buildReportData,
  buildCsv,
  buildPdf,
};

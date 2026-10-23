// db.js
// Data layer for Ledgerix, backed by Firebase Firestore (a real cloud NoSQL
// database) instead of a local JSON file. This means your data now lives in
// Google's cloud, survives server restarts/redeploys, and can be viewed
// live in the Firebase Console.
//
// Setup required before this will work — see README.md "Firebase setup".
// You need a serviceAccountKey.json file in this same folder (never commit
// it to GitHub — it's already in .gitignore).

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const KEY_PATH = path.join(__dirname, "serviceAccountKey.json");

// Where the Firebase credentials come from:
//   1. FIREBASE_SERVICE_ACCOUNT environment variable (used when hosted in the
//      cloud, so the key never has to be uploaded to GitHub), or
//   2. serviceAccountKey.json next to this file (used on your own laptop).
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error(
      "\nFIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.\n" +
      "Paste the entire contents of your serviceAccountKey.json file as its value.\n"
    );
    process.exit(1);
  }
} else if (fs.existsSync(KEY_PATH)) {
  serviceAccount = require(KEY_PATH);
} else {
  console.error(
    "\nMissing Firebase credentials.\n" +
    "Locally: put serviceAccountKey.json in the project root (same folder as server.js).\n" +
    "Hosted: set the FIREBASE_SERVICE_ACCOUNT environment variable.\n" +
    "See README.md for full steps.\n"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

const ID_PREFIXES = {
  inventory: "INV",
  sales: "SO",
  purchasing: "PO",
  hr: "EMP",
};

const COUNTERS_DOC = firestore.collection("meta").doc("counters");

function seedData() {
  return {
    inventory: [
      { id: "INV-0001", name: "A4 Bond Paper (Ream)", category: "Office Supplies", qty: 320, price: 185, status: "In Stock" },
      { id: "INV-0002", name: "Ballpoint Pen (Box)", category: "Office Supplies", qty: 12, price: 95, status: "Low Stock" },
      { id: "INV-0003", name: "Steel Hinge 3in", category: "Hardware", qty: 540, price: 22, status: "In Stock" },
      { id: "INV-0004", name: "M6 Bolt (100pc)", category: "Hardware", qty: 0, price: 150, status: "Out of Stock" },
      { id: "INV-0005", name: "USB-C Cable 1m", category: "Electronics", qty: 88, price: 199, status: "In Stock" },
      { id: "INV-0006", name: "Wireless Mouse", category: "Electronics", qty: 6, price: 450, status: "Low Stock" },
    ],
    // Sample history spread over Nov 2025 - Oct 2026 so the dashboard's
    // monthly / quarterly / annual range has something to show.
    // Each row: [customer, date, total, status]
    sales: [
      ["Delfin Hardware", "2025-11-04", 14200, "Completed"],
      ["Corazon Retail", "2025-11-19", 9800, "Completed"],
      ["Manalo Trading Co.", "2025-12-03", 21500, "Completed"],
      ["Bay Area Supplies", "2025-12-15", 17300, "Completed"],
      ["Villareal & Sons", "2025-12-22", 26400, "Completed"],
      ["Delfin Hardware", "2026-01-08", 12100, "Completed"],
      ["Corazon Retail", "2026-01-21", 8600, "Completed"],
      ["Manalo Trading Co.", "2026-02-05", 15900, "Completed"],
      ["Villareal & Sons", "2026-02-17", 11250, "Completed"],
      ["Bay Area Supplies", "2026-02-26", 7400, "Completed"],
      ["Delfin Hardware", "2026-03-04", 19800, "Completed"],
      ["Corazon Retail", "2026-03-12", 13600, "Completed"],
      ["Manalo Trading Co.", "2026-03-27", 8600, "Completed"],
      ["Villareal & Sons", "2026-04-06", 22400, "Completed"],
      ["Bay Area Supplies", "2026-04-14", 16100, "Completed"],
      ["Delfin Hardware", "2026-04-29", 12500, "Completed"],
      ["Corazon Retail", "2026-05-07", 18700, "Completed"],
      ["Manalo Trading Co.", "2026-05-19", 14300, "Completed"],
      ["Villareal & Sons", "2026-05-28", 14000, "Completed"],
      ["Delfin Hardware", "2026-06-03", 24800, "Completed"],
      ["Bay Area Supplies", "2026-06-16", 21200, "Completed"],
      ["Corazon Retail", "2026-06-25", 16000, "Completed"],
      ["Manalo Trading Co.", "2026-07-08", 20500, "Completed"],
      ["Villareal & Sons", "2026-07-17", 19300, "Completed"],
      ["Delfin Hardware", "2026-07-30", 18200, "Completed"],
      ["Delfin Hardware", "2026-08-12", 18400, "Completed"],
      ["Manalo Trading Co.", "2026-08-14", 6200, "Pending"],
      ["Corazon Retail", "2026-08-15", 24950, "Completed"],
      ["Bay Area Supplies", "2026-08-18", 3100, "Cancelled"],
      ["Villareal & Sons", "2026-08-19", 12750, "Pending"],
      ["Corazon Retail", "2026-09-04", 17400, "Completed"],
      ["Bay Area Supplies", "2026-09-13", 22800, "Completed"],
      ["Manalo Trading Co.", "2026-09-24", 9300, "Cancelled"],
      ["Delfin Hardware", "2026-10-05", 15600, "Completed"],
      ["Villareal & Sons", "2026-10-14", 11200, "Pending"],
      ["Corazon Retail", "2026-10-19", 8400, "Pending"],
    ].map(([customer, date, total, status], i) => ({
      id: `SO-${String(i + 1).padStart(4, "0")}`, customer, date, total, status,
    })),
    // Each row: [supplier, date, total, status]
    purchasing: [
      ["Northline Paper Mills", "2025-11-06", 36500, "Received"],
      ["Steelcraft Distributors", "2025-12-09", 22400, "Received"],
      ["TechSource Electronics", "2026-01-12", 31800, "Received"],
      ["Northline Paper Mills", "2026-02-10", 28900, "Received"],
      ["Steelcraft Distributors", "2026-03-11", 19600, "Received"],
      ["TechSource Electronics", "2026-04-13", 34200, "Received"],
      ["Northline Paper Mills", "2026-05-12", 38700, "Received"],
      ["Steelcraft Distributors", "2026-06-09", 24300, "Received"],
      ["TechSource Electronics", "2026-07-14", 29100, "Received"],
      ["Northline Paper Mills", "2026-08-10", 42000, "Received"],
      ["Steelcraft Distributors", "2026-08-13", 15800, "In Transit"],
      ["TechSource Electronics", "2026-08-17", 27500, "Pending"],
      ["Northline Paper Mills", "2026-09-15", 33400, "Received"],
      ["Steelcraft Distributors", "2026-10-08", 18900, "In Transit"],
      ["TechSource Electronics", "2026-10-16", 26700, "Pending"],
    ].map(([supplier, date, total, status], i) => ({
      id: `PO-${String(i + 1).padStart(4, "0")}`, supplier, date, total, status,
    })),
    hr: [
      { id: "EMP-0001", name: "Marisol Cruz", position: "Warehouse Supervisor", dept: "Inventory", status: "Active" },
      { id: "EMP-0002", name: "Rafael Santos", position: "Sales Associate", dept: "Sales", status: "Active" },
      { id: "EMP-0003", name: "Bea Fernandez", position: "Procurement Officer", dept: "Purchasing", status: "On Leave" },
      { id: "EMP-0004", name: "Julian Reyes", position: "HR Assistant", dept: "HR", status: "Active" },
    ],
  };
}

/* ---------------------------------------------------------
   Auto-seed on first run
   Firestore starts empty — if the "inventory" collection has zero
   documents, we assume this is a fresh database and load the sample data.
--------------------------------------------------------- */
async function ensureSeeded() {
  const snap = await firestore.collection("inventory").limit(1).get();
  if (!snap.empty) return; // already has data, don't touch it

  console.log("Firestore looks empty — loading seed/sample data...");
  const seed = seedData();
  const batch = firestore.batch();

  Object.keys(seed).forEach((collectionName) => {
    seed[collectionName].forEach((record) => {
      const { id, ...rest } = record;
      batch.set(firestore.collection(collectionName).doc(id), rest);
    });
  });

  const counters = {
    inventory: seed.inventory.length,
    sales: seed.sales.length,
    purchasing: seed.purchasing.length,
    hr: seed.hr.length,
  };
  batch.set(COUNTERS_DOC, counters);

  await batch.commit();
  console.log("Seed data loaded into Firestore.");
}

/* ---------------------------------------------------------
   CRUD helpers — same function names as the old JSON version,
   so server.js barely had to change.
--------------------------------------------------------- */

async function getAll(collectionName) {
  const snap = await firestore.collection(collectionName).get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Newest first, similar to the old unshift() behavior
  docs.sort((a, b) => b.id.localeCompare(a.id));
  return docs;
}

async function generateId(collectionName) {
  return firestore.runTransaction(async (t) => {
    const doc = await t.get(COUNTERS_DOC);
    const data = doc.exists ? doc.data() : {};
    const next = (data[collectionName] || 0) + 1;
    t.set(COUNTERS_DOC, { ...data, [collectionName]: next }, { merge: true });
    return `${ID_PREFIXES[collectionName]}-${String(next).padStart(4, "0")}`;
  });
}

async function createRecord(collectionName, payload) {
  const id = await generateId(collectionName);
  await firestore.collection(collectionName).doc(id).set(payload);
  return { id, ...payload };
}

async function updateRecord(collectionName, id, payload) {
  const ref = firestore.collection(collectionName).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return { id, ...updated.data() };
}

async function deleteRecord(collectionName, id) {
  const ref = firestore.collection(collectionName).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}

async function resetToSeed() {
  const seed = seedData();
  const collections = Object.keys(seed);

  // delete every existing document in each collection
  for (const collectionName of collections) {
    const snap = await firestore.collection(collectionName).get();
    const batch = firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // re-insert seed data + reset counters
  const batch = firestore.batch();
  collections.forEach((collectionName) => {
    seed[collectionName].forEach((record) => {
      const { id, ...rest } = record;
      batch.set(firestore.collection(collectionName).doc(id), rest);
    });
  });
  batch.set(COUNTERS_DOC, {
    inventory: seed.inventory.length,
    sales: seed.sales.length,
    purchasing: seed.purchasing.length,
    hr: seed.hr.length,
  });
  await batch.commit();

  const result = {};
  for (const collectionName of collections) {
    result[collectionName] = await getAll(collectionName);
  }
  return result;
}

module.exports = {
  ensureSeeded,
  getAll,
  createRecord,
  updateRecord,
  deleteRecord,
  resetToSeed,
  ID_PREFIXES,
};

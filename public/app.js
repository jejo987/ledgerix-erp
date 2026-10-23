/* ---------------------------------------------------------
   NAV CONFIG
--------------------------------------------------------- */
const NAV = [
  { key:"dashboard", label:"Dashboard", accent:"#4E8C7C", icon:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>' },
  { key:"inventory", label:"Inventory", accent:"#4E8C7C", icon:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>' },
  { key:"sales", label:"Sales", accent:"#A9812E", icon:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
  { key:"purchasing", label:"Purchasing", accent:"#3E5C76", icon:'<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
  { key:"hr", label:"Employee", accent:"#8A4B32", icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { key:"reports", label:"Reports", accent:"#5B4B8A", icon:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
];
const NAV_LABEL = Object.fromEntries(NAV.map(n => [n.key, n.label]));

const navList = document.getElementById("navList");
NAV.forEach(item => {
  const btn = document.createElement("button");
  btn.className = "nav-item" + (item.key === "dashboard" ? " active" : "");
  btn.style.setProperty("--accent", item.accent);
  btn.dataset.key = item.key;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icon}</svg>${item.label}`;
  btn.onclick = () => setActivePage(item.key);
  navList.appendChild(btn);
});

const PAGE_ACCENT = { dashboard:"#22463F", inventory:"#22463F", sales:"#A9812E", purchasing:"#3E5C76", hr:"#8A4B32", reports:"#5B4B8A" };

function setActivePage(key){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-" + key).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.key === key));
  document.getElementById("crumbLabel").textContent = NAV_LABEL[key] || key;
  document.getElementById("crumbLabel").style.color = PAGE_ACCENT[key];
  closeSidebar();
  if(key === "dashboard" || key === "reports") refreshRangeViews();
}

/* Mobile sidebar toggle */
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
document.getElementById("menu-btn").onclick = () => { sidebar.classList.add("open"); overlay.classList.add("show"); };
document.getElementById("closeSidebar").onclick = closeSidebar;
overlay.onclick = closeSidebar;
function closeSidebar(){ sidebar.classList.remove("open"); overlay.classList.remove("show"); }

/* ---------------------------------------------------------
   API HELPERS
--------------------------------------------------------- */
const API = "/api";

class ApiError extends Error {
  constructor(message, status){ super(message); this.status = status; }
}
async function apiError(res, fallback){
  let message = fallback;
  try {
    const body = await res.json();
    if(body && body.error) message = body.error;
  } catch (e) { /* no JSON body */ }
  return new ApiError(message, res.status);
}

async function apiGet(path){
  const res = await fetch(`${API}/${path}`);
  if(!res.ok) throw await apiError(res, `GET ${path} failed`);
  return res.json();
}
async function apiPost(path, body){
  const res = await fetch(`${API}/${path}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  if(!res.ok) throw await apiError(res, `POST ${path} failed`);
  return res.json();
}
async function apiPut(path, body){
  const res = await fetch(`${API}/${path}`, { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  if(!res.ok) throw await apiError(res, `PUT ${path} failed`);
  return res.json();
}
async function apiDelete(path){
  const res = await fetch(`${API}/${path}`, { method:"DELETE" });
  if(!res.ok && res.status !== 204) throw await apiError(res, `DELETE ${path} failed`);
}

function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

/* Escape user-entered text before putting it into HTML */
function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

/* ---------------------------------------------------------
   MODULE CONFIG — drives table rendering AND the add/edit form
   required:true  -> the field cannot be left empty (number fields must be > 0)
   type:"auto-date" -> shown read-only; the server stamps the date
--------------------------------------------------------- */
const MODULE_CONFIG = {
  inventory: {
    label: "Item", api: "inventory",
    columns: ["SKU","Item Name","Category","Qty","Unit Price","Status"],
    fields: [
      { key:"name", label:"Item Name", type:"text" },
      { key:"category", label:"Category", type:"text" },
      { key:"qty", label:"Quantity", type:"number" },
      { key:"price", label:"Unit Price (₱)", type:"number" },
      { key:"status", label:"Status", type:"select", options:["In Stock","Low Stock","Out of Stock"] },
    ],
    renderRow: r => `
      <td><span class="mono-chip">${esc(r.id)}</span></td>
      <td class="cell-strong">${esc(r.name)}</td>
      <td class="cell-muted">${esc(r.category)}</td>
      <td class="mono">${esc(r.qty)}</td>
      <td class="mono">${peso(r.price)}</td>
      <td>${badge(r.status)}</td>`,
  },
  sales: {
    label: "Order", api: "sales",
    columns: ["Order ID","Customer","Date","Total","Status"],
    fields: [
      { key:"customer", label:"Customer", type:"text", required:true },
      { key:"date", label:"Date (automatic)", type:"auto-date" },
      { key:"total", label:"Total (₱)", type:"number", required:true, min:"0.01", step:"0.01" },
      { key:"status", label:"Status", type:"select", required:true, options:["Pending","Completed","Cancelled"] },
    ],
    renderRow: r => `
      <td><span class="mono-chip">${esc(r.id)}</span></td>
      <td class="cell-strong">${esc(r.customer)}</td>
      <td class="mono cell-date">${esc(r.date)}</td>
      <td class="mono">${peso(r.total)}</td>
      <td>${badge(r.status)}</td>`,
  },
  purchasing: {
    label: "Purchase Order", api: "purchasing",
    columns: ["PO Number","Supplier","Date","Total","Status"],
    fields: [
      { key:"supplier", label:"Supplier", type:"text", required:true },
      { key:"date", label:"Date (automatic)", type:"auto-date" },
      { key:"total", label:"Total (₱)", type:"number", required:true, min:"0.01", step:"0.01" },
      { key:"status", label:"Status", type:"select", required:true, options:["Pending","In Transit","Received"] },
    ],
    renderRow: r => `
      <td><span class="mono-chip">${esc(r.id)}</span></td>
      <td class="cell-strong">${esc(r.supplier)}</td>
      <td class="mono cell-date">${esc(r.date)}</td>
      <td class="mono">${peso(r.total)}</td>
      <td>${badge(r.status)}</td>`,
  },
  hr: {
    label: "Employee", api: "hr",
    columns: ["Employee ID","Employee","Position","Department","Employee Status"],
    fields: [
      { key:"name", label:"Employee", type:"text" },
      { key:"position", label:"Position", type:"text" },
      { key:"dept", label:"Department", type:"text" },
      { key:"status", label:"Employee Status", type:"select", options:["Active","On Leave"] },
    ],
    renderRow: r => `
      <td><span class="mono-chip">${esc(r.id)}</span></td>
      <td class="cell-strong">${esc(r.name)}</td>
      <td class="cell-muted">${esc(r.position)}</td>
      <td class="cell-muted">${esc(r.dept)}</td>
      <td>${badge(r.status)}</td>`,
  },
};

const BADGE_CLASSES = {
  "In Stock":"badge-instock", "Low Stock":"badge-lowstock", "Out of Stock":"badge-outofstock",
  "Completed":"badge-completed", "Received":"badge-received", "Pending":"badge-pending",
  "In Transit":"badge-intransit", "Cancelled":"badge-cancelled", "Active":"badge-active", "On Leave":"badge-onleave",
};
function badge(status){
  const cls = BADGE_CLASSES[status] || "";
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}
function peso(n){ return "₱" + Number(n || 0).toLocaleString(); }
function emptyRow(cols){ return `<tr class="empty-row"><td colspan="${cols}">No records match your search.</td></tr>`; }

/* In-memory cache of the currently loaded rows per module (so search + edit/delete
   don't need a network round trip every keystroke) */
const state = { inventory: [], sales: [], purchasing: [], hr: [] };

const CONTAINER_IDS = {
  inventory: { body:"inventoryBody", search:"inventorySearch", count:"inventoryCount", noun:"items tracked" },
  sales: { body:"salesBody", search:"salesSearch", count:"salesCount", noun:"orders recorded" },
  purchasing: { body:"purchasingBody", search:"purchasingSearch", count:"purchasingCount", noun:"purchase orders" },
  hr: { body:"hrBody", search:"hrSearch", count:"hrCount", noun:"employees" },
};

async function loadModule(moduleKey){
  const cfg = MODULE_CONFIG[moduleKey];
  const data = await apiGet(cfg.api);
  state[moduleKey] = data;
  renderModule(moduleKey);
}

function renderModule(moduleKey){
  const cfg = MODULE_CONFIG[moduleKey];
  const ids = CONTAINER_IDS[moduleKey];
  const q = document.getElementById(ids.search).value.toLowerCase();
  const rows = state[moduleKey].filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(q))
  );
  document.getElementById(ids.count).textContent = `${state[moduleKey].length} ${ids.noun}`;
  const body = document.getElementById(ids.body);
  body.innerHTML = rows.length
    ? rows.map(r => `
        <tr>
          ${cfg.renderRow(r)}
          <td>
            <div class="row-actions">
              <button title="Edit" onclick="openEditModal('${moduleKey}','${esc(r.id)}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="danger" title="Delete" onclick="deleteRow('${moduleKey}','${esc(r.id)}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`).join("")
    : emptyRow(cfg.columns.length + 1);
}

/* Wire up search boxes */
Object.keys(CONTAINER_IDS).forEach(moduleKey => {
  document.getElementById(CONTAINER_IDS[moduleKey].search).addEventListener("input", () => renderModule(moduleKey));
});

/* ---------------------------------------------------------
   ADD / EDIT MODAL
--------------------------------------------------------- */
let modalState = { moduleKey: null, editingId: null };

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalFields = document.getElementById("modalFields");
const modalError = document.getElementById("modalError");

function openAddModal(moduleKey){
  modalState = { moduleKey, editingId: null };
  const cfg = MODULE_CONFIG[moduleKey];
  modalTitle.textContent = `Add ${cfg.label}`;
  modalError.textContent = "";
  buildModalFields(cfg, {});
  modalOverlay.classList.add("show");
}

function openEditModal(moduleKey, id){
  modalState = { moduleKey, editingId: id };
  const cfg = MODULE_CONFIG[moduleKey];
  const record = state[moduleKey].find(r => r.id === id);
  modalTitle.textContent = `Edit ${cfg.label}`;
  modalError.textContent = "";
  buildModalFields(cfg, record || {});
  modalOverlay.classList.add("show");
}

function todayLocalISO(){
  // en-CA formats dates as YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA");
}

function buildModalFields(cfg, values){
  modalFields.innerHTML = cfg.fields.map(f => {
    const val = values[f.key] ?? "";
    const labelHtml = `<label class="${f.required ? "req" : ""}">${esc(f.label)}</label>`;
    if(f.type === "auto-date"){
      const shown = val || todayLocalISO();
      return `<div class="field-group">${labelHtml}<input type="text" value="${esc(shown)}" disabled /><p class="field-hint">Set automatically when the record is saved</p></div>`;
    }
    if(f.type === "select"){
      const opts = f.options.map(o => `<option value="${esc(o)}" ${o === val ? "selected" : ""}>${esc(o)}</option>`).join("");
      return `<div class="field-group">${labelHtml}<select data-field="${f.key}">${opts}</select></div>`;
    }
    const attrs = [f.min ? `min="${f.min}"` : "", f.step ? `step="${f.step}"` : ""].join(" ");
    return `<div class="field-group">${labelHtml}<input data-field="${f.key}" type="${f.type}" value="${esc(val)}" ${attrs} /></div>`;
  }).join("");
}

function closeModal(){
  modalOverlay.classList.remove("show");
}
document.getElementById("modalCloseBtn").onclick = closeModal;
document.getElementById("modalCancelBtn").onclick = closeModal;
modalOverlay.addEventListener("click", (e) => { if(e.target === modalOverlay) closeModal(); });
modalFields.addEventListener("input", () => { modalError.textContent = ""; });

document.getElementById("modalSaveBtn").onclick = async () => {
  const { moduleKey, editingId } = modalState;
  const cfg = MODULE_CONFIG[moduleKey];
  const payload = {};

  for(const f of cfg.fields){
    if(f.type === "auto-date") continue;       // the server sets the date
    const raw = modalFields.querySelector(`[data-field="${f.key}"]`).value;
    const name = f.label.replace(/\s*\(.*\)/, "");

    if(f.type === "number"){
      if(f.required && (raw === "" || !(Number(raw) > 0))){
        modalError.textContent = `${name} must be a number greater than 0`;
        return;
      }
      payload[f.key] = Number(raw || 0);
    } else {
      if(f.required && !raw.trim()){
        modalError.textContent = `${name} is required`;
        return;
      }
      payload[f.key] = f.required ? raw.trim() : raw;
    }
  }

  try {
    if(editingId){
      await apiPut(`${cfg.api}/${editingId}`, payload);
      toast(`${cfg.label} updated`);
    } else {
      await apiPost(cfg.api, payload);
      toast(`${cfg.label} added`);
    }
  } catch (err){
    if(err.status === 400){
      modalError.textContent = err.message;   // validation message from the server
    } else {
      toast("Something went wrong — check the server is running");
    }
    return;
  }
  closeModal();
  await loadModule(moduleKey);
  refreshRangeViews();
};

async function deleteRow(moduleKey, id){
  const cfg = MODULE_CONFIG[moduleKey];
  if(!confirm(`Delete this ${cfg.label.toLowerCase()}? This cannot be undone.`)) return;
  try {
    await apiDelete(`${cfg.api}/${id}`);
    toast(`${cfg.label} deleted`);
    await loadModule(moduleKey);
    refreshRangeViews();
  } catch (err){
    toast("Delete failed — check the server is running");
  }
}

/* Wire Add buttons */
document.querySelectorAll("[data-add-module]").forEach(btn => {
  btn.addEventListener("click", () => openAddModal(btn.dataset.addModule));
});

/* ---------------------------------------------------------
   SVG CHARTS — hand-drawn, no external library required
--------------------------------------------------------- */
function svgEl(tag, attrs){
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for(const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

/* With 28-31 daily points, only label every few so the axis stays readable */
function labelEvery(count){ return Math.max(1, Math.ceil(count / 12)); }

function drawLineChart(containerId, labels, values, color){
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const w = 460, h = 200, padL = 36, padR = 12, padT = 12, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const max = Math.max(...values, 1) * 1.15, min = 0;
  const x = i => padL + (innerW * i) / Math.max(values.length - 1, 1);
  const y = v => padT + innerH - ((v - min) / (max - min)) * innerH;
  const every = labelEvery(labels.length);
  const dotR = values.length > 16 ? 2.5 : 3.5;

  const svg = svgEl("svg", { viewBox:`0 0 ${w} ${h}`, width:"100%", height:"200", preserveAspectRatio:"xMidYMid meet" });
  for(let i=0;i<=3;i++){
    const gy = padT + (innerH * i) / 3;
    svg.appendChild(svgEl("line", { x1:padL, x2:w-padR, y1:gy, y2:gy, stroke:"#EEF0EE", "stroke-width":1 }));
  }
  let areaPath = `M ${x(0)} ${y(values[0])} `;
  values.forEach((v,i) => { if(i>0) areaPath += `L ${x(i)} ${y(v)} `; });
  areaPath += `L ${x(values.length-1)} ${padT+innerH} L ${x(0)} ${padT+innerH} Z`;
  svg.appendChild(svgEl("path", { d:areaPath, fill:color, opacity:"0.12" }));
  let linePath = `M ${x(0)} ${y(values[0])} `;
  values.forEach((v,i) => { if(i>0) linePath += `L ${x(i)} ${y(v)} `; });
  svg.appendChild(svgEl("path", { d:linePath, fill:"none", stroke:color, "stroke-width":2.5, "stroke-linejoin":"round", "stroke-linecap":"round" }));
  values.forEach((v,i) => {
    const dot = svgEl("circle", { cx:x(i), cy:y(v), r:dotR, fill:color });
    const tip = svgEl("title", {});
    tip.textContent = `${labels[i]}: ${peso(v)}`;
    dot.appendChild(tip);
    svg.appendChild(dot);
    if(i % every === 0){
      const t = svgEl("text", { x:x(i), y:h-6, "text-anchor":"middle", "font-size":"11", fill:"#66756D" });
      t.textContent = labels[i];
      svg.appendChild(t);
    }
  });
  container.appendChild(svg);
}

function drawBarChart(containerId, labels, values, color){
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const w = 460, h = 200, padL = 36, padR = 12, padT = 12, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const max = Math.max(...values, 1) * 1.15;
  const gap = (innerW / values.length);
  const barW = gap * 0.6;
  const every = labelEvery(labels.length);

  const svg = svgEl("svg", { viewBox:`0 0 ${w} ${h}`, width:"100%", height:"200", preserveAspectRatio:"xMidYMid meet" });
  for(let i=0;i<=3;i++){
    const gy = padT + (innerH * i) / 3;
    svg.appendChild(svgEl("line", { x1:padL, x2:w-padR, y1:gy, y2:gy, stroke:"#EEF0EE", "stroke-width":1 }));
  }
  values.forEach((v,i) => {
    const barH = (v / max) * innerH;
    const bx = padL + gap * i + (gap - barW) / 2;
    const by = padT + innerH - barH;
    const bar = svgEl("rect", { x:bx, y:by, width:barW, height:barH, rx:Math.min(4, barW/2), fill:color });
    const tip = svgEl("title", {});
    tip.textContent = `${labels[i]}: ${peso(v)}`;
    bar.appendChild(tip);
    svg.appendChild(bar);
    if(i % every === 0){
      const t = svgEl("text", { x:bx + barW/2, y:h-6, "text-anchor":"middle", "font-size":"11", fill:"#66756D" });
      t.textContent = labels[i];
      svg.appendChild(t);
    }
  });
  container.appendChild(svg);
}

function drawHBarChart(containerId, labels, values, color){
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const w = 460, rowH = 44, padL = 110, padR = 50, padT = 8;
  const h = padT * 2 + rowH * Math.max(values.length, 1);
  const innerW = w - padL - padR;
  const max = Math.max(...values, 1) * 1.1;

  const svg = svgEl("svg", { viewBox:`0 0 ${w} ${h}`, width:"100%", height:h, preserveAspectRatio:"xMidYMid meet" });
  values.forEach((v,i) => {
    const barW = (v / max) * innerW;
    const by = padT + rowH * i + rowH*0.25;
    const label = svgEl("text", { x:padL-10, y:by+rowH*0.25+4, "text-anchor":"end", "font-size":"12", fill:"#66756D" });
    label.textContent = labels[i];
    svg.appendChild(label);
    svg.appendChild(svgEl("rect", { x:padL, y:by, width:innerW, height:rowH*0.5, rx:4, fill:"#EEF0EE" }));
    svg.appendChild(svgEl("rect", { x:padL, y:by, width:barW, height:rowH*0.5, rx:4, fill:color }));
    const val = svgEl("text", { x:padL+barW+8, y:by+rowH*0.25+4, "font-size":"12", fill:"#1B241F", "font-family":"IBM Plex Mono, monospace" });
    val.textContent = v;
    svg.appendChild(val);
  });
  container.appendChild(svg);
}

function drawDonutChart(containerId, values, colors){
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const size = 180, cx = size/2, cy = size/2, rOuter = 78, rInner = 46;
  const total = values.reduce((a,b)=>a+b, 0) || 1;
  let angle = -Math.PI/2;
  const svg = svgEl("svg", { viewBox:`0 0 ${size} ${size}`, width:"180", height:"180" });
  values.forEach((v,i) => {
    const slice = (v/total) * Math.PI * 2;
    if(slice <= 0) return;
    const a0 = angle, a1 = angle + Math.min(slice, Math.PI * 2 - 0.0001);
    const x0o = cx + rOuter*Math.cos(a0), y0o = cy + rOuter*Math.sin(a0);
    const x1o = cx + rOuter*Math.cos(a1), y1o = cy + rOuter*Math.sin(a1);
    const x1i = cx + rInner*Math.cos(a1), y1i = cy + rInner*Math.sin(a1);
    const x0i = cx + rInner*Math.cos(a0), y0i = cy + rInner*Math.sin(a0);
    const largeArc = (a1 - a0) > Math.PI ? 1 : 0;
    const d = `M ${x0o} ${y0o} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x0i} ${y0i} Z`;
    svg.appendChild(svgEl("path", { d, fill: colors[i % colors.length] }));
    angle += slice;
  });
  container.appendChild(svg);
}

function noteIfEmpty(containerId, values, text){
  if(values.some(v => v > 0)) return;
  document.getElementById(containerId).insertAdjacentHTML("beforeend", `<p class="chart-empty">${text}</p>`);
}

/* ---------------------------------------------------------
   RANGE SELECTOR — Monthly / Quarterly / Annually + slider
   One shared state drives both the Dashboard and the Reports page.
--------------------------------------------------------- */
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = MONTH_NAMES.map(m => m.slice(0, 3));
const PERIOD_LABELS = { monthly:"Monthly", quarterly:"Quarterly", annual:"Annually" };

const rangeState = { ready:false, period:"monthly", year:new Date().getFullYear(), month:new Date().getMonth() + 1, meta:{ minYear:new Date().getFullYear(), maxYear:new Date().getFullYear() } };

/* What the slider looks like for the current period */
function sliderConfig(){
  const { period, year, month, meta } = rangeState;
  if(period === "quarterly"){
    const q = Math.ceil(month / 3);
    return { min:1, max:4, value:q, label:`Q${q} ${year}`, ticks:[1,2,3,4].map(n => ({ value:n, text:`Q${n}` })) };
  }
  if(period === "annual"){
    const years = [];
    for(let y = meta.minYear; y <= meta.maxYear; y++) years.push(y);
    return { min:meta.minYear, max:meta.maxYear, value:year, label:`${year}`, ticks: years.map(y => ({ value:y, text:String(y) })) };
  }
  return { min:1, max:12, value:month, label:`${MONTH_NAMES[month - 1]} ${year}`, ticks: MONTH_SHORT.map((t, i) => ({ value:i + 1, text:t })) };
}

function rangeQuery(){
  const { period, year, month } = rangeState;
  const n = period === "monthly" ? month : period === "quarterly" ? Math.ceil(month / 3) : year;
  return `period=${period}&year=${year}&n=${n}`;
}

function mountRangeControls(){
  document.querySelectorAll("[data-range-control]").forEach(host => {
    host.innerHTML = `
      <div class="range-top">
        <div class="seg">
          ${Object.entries(PERIOD_LABELS).map(([k, t]) => `<button type="button" class="seg-btn" data-period="${k}">${t}</button>`).join("")}
        </div>
        <label class="range-year">Year <select data-range-year></select></label>
        <div class="range-label" data-range-label></div>
      </div>
      <input type="range" class="range-slider" data-range-slider step="1" aria-label="Select period">
      <div class="range-ticks" data-range-ticks></div>`;

    host.querySelectorAll("[data-period]").forEach(btn => btn.addEventListener("click", () => {
      rangeState.period = btn.dataset.period;
      syncRangeControls();
      scheduleRefresh();
    }));
    host.querySelector("[data-range-year]").addEventListener("change", e => {
      rangeState.year = Number(e.target.value);
      syncRangeControls();
      scheduleRefresh();
    });
    host.querySelector("[data-range-slider]").addEventListener("input", e => setRangeValue(Number(e.target.value)));
    host.querySelector("[data-range-ticks]").addEventListener("click", e => {
      const tick = e.target.closest("[data-value]");
      if(tick) setRangeValue(Number(tick.dataset.value));
    });
  });
}

function setRangeValue(v){
  if(rangeState.period === "monthly") rangeState.month = v;
  else if(rangeState.period === "quarterly") rangeState.month = (v - 1) * 3 + 1;
  else rangeState.year = v;
  syncRangeControls();
  scheduleRefresh();
}

function syncRangeControls(){
  const cfg = sliderConfig();
  const { meta } = rangeState;
  const years = [];
  for(let y = meta.maxYear; y >= meta.minYear; y--) years.push(y);

  document.querySelectorAll("[data-range-control]").forEach(host => {
    host.querySelectorAll("[data-period]").forEach(btn => btn.classList.toggle("active", btn.dataset.period === rangeState.period));

    const yearWrap = host.querySelector(".range-year");
    yearWrap.hidden = rangeState.period === "annual";   // the slider picks the year instead
    const yearSel = host.querySelector("[data-range-year]");
    yearSel.innerHTML = years.map(y => `<option value="${y}" ${y === rangeState.year ? "selected" : ""}>${y}</option>`).join("");

    const slider = host.querySelector("[data-range-slider]");
    slider.min = cfg.min;
    slider.max = cfg.max;
    slider.value = cfg.value;
    slider.disabled = cfg.min === cfg.max;

    host.querySelector("[data-range-label]").textContent = cfg.label;
    host.querySelector("[data-range-ticks]").innerHTML = cfg.ticks
      .map(t => `<button type="button" class="tick ${t.value === cfg.value ? "active" : ""}" data-value="${t.value}">${t.text}</button>`).join("");
  });
}

/* Slider dragging fires a lot of events; wait a moment before asking the server */
let refreshTimer = null;
function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshRangeViews, 150);
}

let latestRequest = 0;
async function refreshRangeViews(){
  if(!rangeState.ready) return;
  const requestId = ++latestRequest;
  try {
    const summary = await apiGet(`dashboard/summary?${rangeQuery()}`);
    if(requestId !== latestRequest) return;       // a newer request is already on its way
    const metaChanged = JSON.stringify(summary.meta) !== JSON.stringify(rangeState.meta);
    rangeState.meta = summary.meta;
    if(metaChanged) syncRangeControls();
    renderDashboard(summary);
    renderReports(summary);
  } catch (err){
    toast("Could not load the summary — check the server is running");
  }
}

/* ---------------------------------------------------------
   DASHBOARD + REPORTS RENDERING
--------------------------------------------------------- */
const PIE_COLORS = ["#22463F", "#A9812E", "#3E5C76", "#8A4B32", "#5B4B8A"];

function seriesTitle(summary){
  return summary.range.bucketBy === "day" ? `Sales by day, ${summary.range.label}` : `Sales by month, ${summary.range.label}`;
}

function renderDashboard(s){
  const label = s.range.label;
  document.getElementById("statTotalSales").textContent = peso(s.totalSales);
  document.getElementById("statSalesSub").textContent = `${s.orderCount} order${s.orderCount === 1 ? "" : "s"} in ${label}`;
  document.getElementById("statInventoryUnits").textContent = s.totalInventoryUnits.toLocaleString();
  document.getElementById("statLowStock").textContent = s.lowStockCount;
  document.getElementById("statPendingPOs").textContent = s.pendingPOs;
  document.getElementById("statPOSub").textContent = `Pending in ${label}`;

  document.getElementById("trendTitle").textContent = seriesTitle(s);
  drawLineChart("salesTrendChart", s.series.labels, s.series.values, "#A9812E");
  noteIfEmpty("salesTrendChart", s.series.values, "No sales recorded in this period.");

  drawDonutChart("stockPieChart", s.stockByCategory.map(d => d.value), PIE_COLORS);
  document.getElementById("pieLegend").innerHTML = s.stockByCategory.map((c, i) =>
    `<div class="row"><span class="dot dot-c${i % 5}"></span>${esc(c.name)}</div>`).join("");
}

function renderReports(s){
  const label = s.range.label;
  document.getElementById("reportPeriod").textContent = label;
  const q = rangeQuery();
  document.getElementById("downloadPdf").href = `${API}/reports/download?format=pdf&${q}`;
  document.getElementById("downloadCsv").href = `${API}/reports/download?format=csv&${q}`;

  const metrics = [
    ["Total sales", peso(s.totalSales), "excludes cancelled orders"],
    ["Orders", s.orderCount, `${s.completedOrders} completed · ${s.pendingOrders} pending · ${s.cancelledOrders} cancelled`],
    ["Purchase spend", peso(s.purchaseSpend), `${s.poCount} purchase order${s.poCount === 1 ? "" : "s"}`],
    ["Low stock items", s.lowStockCount, "current stock"],
    ["Employees", s.employeeCount, `${s.activeEmployees} active · ${s.employeesOnLeave} on leave`],
  ];
  document.getElementById("reportMetrics").innerHTML = metrics.map(([name, value, sub]) =>
    `<div class="metric"><p class="m-label">${name}</p><p class="m-value">${value}</p><p class="m-sub">${sub}</p></div>`).join("");

  document.getElementById("reportsBarTitle").textContent = seriesTitle(s) + " (₱)";
  drawBarChart("reportsBarChart", s.series.labels, s.series.values, "#5B4B8A");
  noteIfEmpty("reportsBarChart", s.series.values, "No sales recorded in this period.");
  drawHBarChart("reportsHBarChart", s.stockByCategory.map(d => d.name), s.stockByCategory.map(d => d.value), "#22463F");
}

/* ---------------------------------------------------------
   INITIAL LOAD
--------------------------------------------------------- */
async function initRange(){
  // No parameters: the server picks the latest month that has sales
  const summary = await apiGet("dashboard/summary");
  rangeState.period = "monthly";
  rangeState.year = summary.range.year;
  rangeState.month = summary.range.n;
  rangeState.meta = summary.meta;
  rangeState.ready = true;
  mountRangeControls();
  syncRangeControls();
  renderDashboard(summary);
  renderReports(summary);
}

(async function init(){
  try {
    await Promise.all([
      loadModule("inventory"),
      loadModule("sales"),
      loadModule("purchasing"),
      loadModule("hr"),
    ]);
    await initRange();
  } catch (err){
    toast("Could not reach the server — is it running?");
  }
})();

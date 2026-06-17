/**
 * Fair Ford · Distributor Panel · app.js
 * Vanilla JS — no framework required.
 * Depends on: Chart.js (loaded via CDN in index.html)
 */

"use strict";

/* ══════════════════════════════════════════════════════════════
   DATA
══════════════════════════════════════════════════════════════ */

let revenueData = [];
let territoryData = [];
let recentOrders = [];
let topRetailers = [];
let schemes = [];
let aiAlerts = [];

const STATUS_STYLES = {
  Dispatched: { bg: "#dbeafe", color: "#1d4ed8", dot: "#3b82f6" },
  Pending:    { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  Delivered:  { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
  Approved:   { bg: "#ede9fe", color: "#4c1d95", dot: "#8b5cf6" },
};

const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000/api" : "/api";
const TOKEN_KEY = "ff_token";

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error("Please login again");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function ensureLogin() {
  const existingToken = localStorage.getItem(TOKEN_KEY);
  if (!existingToken) {
    window.location.replace("/login&signup.html");
    await new Promise(() => {}); // hang until navigation completes
  }

  try {
    const data = await apiFetch("/auth/profile");
    const user = data.user || {};
    updateDistributorHeader({
      name: user.name || "Distributor",
      territory: user.territory || "Maharashtra",
      walletBalance: user.walletBalance || 243500,
    });
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.replace("/login&signup.html");
    await new Promise(() => {}); // hang until navigation completes
  }
}

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function shortDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function updateDistributorHeader(distributor = {}) {
  const wallet = document.querySelector(".wallet-chip .wv");
  if (wallet) wallet.textContent = formatINR(distributor.walletBalance || 0);

  const userName = document.querySelector(".user-name");
  if (userName && distributor.name) userName.textContent = distributor.name;

  const brandTag = document.querySelector(".brand-tag");
  if (brandTag && distributor.territory) brandTag.textContent = `${distributor.name || "Distributor"} · ${distributor.territory}`;

  const welcome = document.querySelector(".welcome-title");
  if (welcome && distributor.name) welcome.textContent = `Welcome back, ${distributor.name}!`;
}

function updateDashboardMetrics(metrics) {
  const statValues = document.querySelectorAll(".stat-card .stat-value");
  const statSubs = document.querySelectorAll(".stat-card .stat-sub");
  if (statValues[0]) statValues[0].textContent = metrics.ordersThisMonth ?? metrics.totalOrders ?? 0;
  if (statValues[1]) statValues[1].textContent = formatINR(metrics.revenue);
  if (statValues[2]) statValues[2].textContent = formatINR(metrics.outstandingPayments);
  if (statValues[3]) statValues[3].textContent = Number(metrics.activeRetailers || 0).toLocaleString("en-IN");
  if (statSubs[2]) statSubs[2].textContent = `${metrics.pendingPaymentRetailers || 0} retailers pending`;

  const actionValues = document.querySelectorAll(".action-badge .ab-v");
  if (actionValues[0]) actionValues[0].textContent = metrics.pendingDispatch || 0;
  if (actionValues[1]) actionValues[1].textContent = metrics.pendingApproval || 0;
  if (actionValues[2]) actionValues[2].textContent = metrics.lowStockSkus || 0;
  if (actionValues[3]) actionValues[3].textContent = metrics.retailerRequests || 0;

  const wallet = document.querySelector(".wallet-chip .wv");
  if (wallet) wallet.textContent = formatINR(metrics.walletBalance);
}

async function loadDashboardData() {
  const [
    metrics,
    revenue,
    territory,
    orders,
    retailers,
    schemeRows,
    insights,
  ] = await Promise.all([
    apiFetch("/dashboard/metrics"),
    apiFetch("/reports/revenue"),
    apiFetch("/reports/territory"),
    apiFetch("/orders/recent"),
    apiFetch("/retailers/top"),
    apiFetch("/schemes"),
    apiFetch("/insights"),
  ]);

  updateDashboardMetrics(metrics);

  revenueData = revenue;
  territoryData = territory;
  recentOrders = orders.map((order) => ({
    id: order.orderNo,
    retailer: order.retailer?.name || "Unknown Retailer",
    city: order.retailer?.city || "",
    items: order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0,
    amount: order.amount,
    status: order.status,
    date: shortDate(order.orderDate),
  }));
  topRetailers = retailers.map((retailer) => ({
    ...retailer,
    amount: formatINR(retailer.amount),
  }));
  schemes = schemeRows.map((scheme) => ({
    name: scheme.name,
    retailers: scheme.retailersCount || 0,
    expiry: shortDate(scheme.expiryDate),
  }));
  aiAlerts = insights;
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/** Format a number as ₹ shorthand */
function fmt(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(2)}K`;
  return `₹${n}`;
}

/** Safely get an element by ID */
function el(id) { return document.getElementById(id); }

/* ══════════════════════════════════════════════════════════════
   SIDEBAR NAV
══════════════════════════════════════════════════════════════ */

function initSidebar() {
  const navItems = document.querySelectorAll(".nav-item");
  const navChildren = document.querySelectorAll(".nav-child");

  /* Top-level nav clicks */
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      // Deactivate all
      navItems.forEach(i => i.classList.remove("active"));
      navChildren.forEach(c => c.classList.remove("active"));

      item.classList.add("active");

      // Handle expandable groups
      const group = item.dataset.group;
      if (group) {
        const children = el(`group-${group}`);
        const arrow    = el(`arrow-${group}`);
        if (children) {
          const isHidden = children.classList.toggle("hidden");
          arrow && arrow.classList.toggle("open", !isHidden);
        }
      }
    });
  });

  /* Child nav clicks */
  navChildren.forEach(child => {
    child.addEventListener("click", e => {
      e.stopPropagation();
      navChildren.forEach(c => c.classList.remove("active"));
      navItems.forEach(i => i.classList.remove("active"));
      child.classList.add("active");
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   REVENUE CHART  (Chart.js dual-axis area chart)
══════════════════════════════════════════════════════════════ */

function buildRevenueChart() {
  const ctx = el("revenueChart");
  if (!ctx) return;
  if (!revenueData.length) return;

  const labels   = revenueData.map(d => d.month);
  const revenues = revenueData.map(d => d.revenue);
  const orders   = revenueData.map(d => d.orders);

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label      : "Revenue",
          data       : revenues,
          yAxisID    : "yRev",
          borderColor: "#2563eb",
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#2563eb",
          fill       : true,
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return "transparent";
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0,   "rgba(37,99,235,0.20)");
            gradient.addColorStop(1,   "rgba(37,99,235,0.01)");
            return gradient;
          },
          tension: 0.4,
        },
        {
          label      : "Orders",
          data       : orders,
          yAxisID    : "yOrd",
          borderColor: "#7c3aed",
          borderWidth: 1.5,
          borderDash : [5, 3],
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#7c3aed",
          fill       : true,
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return "transparent";
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0,   "rgba(124,58,237,0.12)");
            gradient.addColorStop(1,   "rgba(124,58,237,0.01)");
            return gradient;
          },
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          borderColor    : "#e8eaf2",
          borderWidth    : 1,
          titleColor     : "#0f1629",
          bodyColor      : "#2563eb",
          padding        : 10,
          cornerRadius   : 8,
          boxShadow      : "0 4px 12px rgba(0,0,0,0.08)",
          callbacks: {
            label(ctx) {
              if (ctx.dataset.label === "Revenue") {
                return ` ₹${(ctx.parsed.y / 100000).toFixed(2)}L`;
              }
              return ` ${ctx.parsed.y} orders`;
            },
          },
        },
      },
      scales: {
        x: {
          grid   : { display: false },
          border : { display: false },
          ticks  : { color: "#9ca3af", font: { size: 10, family: "'Sora', sans-serif" } },
        },
        yRev: {
          type    : "linear",
          position: "left",
          grid    : { color: "#f1f5f9", drawBorder: false },
          border  : { display: false },
          ticks   : {
            color   : "#9ca3af",
            font    : { size: 10, family: "'Sora', sans-serif" },
            callback: v => `₹${(v / 100000).toFixed(0)}L`,
          },
        },
        yOrd: {
          type    : "linear",
          position: "right",
          grid    : { display: false },
          border  : { display: false },
          ticks   : {
            color: "#9ca3af",
            font : { size: 10, family: "'Sora', sans-serif" },
          },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   TERRITORY BARS
══════════════════════════════════════════════════════════════ */

function buildTerritoryBars() {
  const container = el("territoryBars");
  if (!container) return;

  container.innerHTML = territoryData.map(t => `
    <div class="terr-row">
      <div class="terr-city">${t.city}</div>
      <div class="terr-track">
        <div class="terr-fill" style="width:0%" data-target="${t.value}"></div>
      </div>
      <div class="terr-val">${t.value}%</div>
    </div>
  `).join("");

  /* Animate bars on next frame */
  requestAnimationFrame(() => {
    container.querySelectorAll(".terr-fill").forEach(fill => {
      fill.style.width = fill.dataset.target + "%";
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   ORDERS TABLE
══════════════════════════════════════════════════════════════ */

function buildOrdersTable() {
  const tbody = el("ordersBody");
  if (!tbody) return;

  tbody.innerHTML = recentOrders.map(o => {
    const s = STATUS_STYLES[o.status] || { bg: "#f1f5f9", color: "#475569", dot: "#94a3b8" };
    return `
      <tr>
        <td><span class="ot-id">${o.id}</span></td>
        <td>
          <div class="ot-retailer">${o.retailer}</div>
          <div class="ot-city">${o.city} · ${o.items} items</div>
        </td>
        <td><span class="ot-amount">${fmt(o.amount)}</span></td>
        <td>
          <span class="status-chip" style="background:${s.bg};color:${s.color}">
            <span class="status-dot" style="background:${s.dot}"></span>
            ${o.status}
          </span>
        </td>
        <td style="color:#6b7280;font-size:11px">${o.date}</td>
        <td><button class="ot-action-btn">👁</button></td>
      </tr>
    `;
  }).join("");
}

/* ══════════════════════════════════════════════════════════════
   TOP RETAILERS
══════════════════════════════════════════════════════════════ */

function buildTopRetailers() {
  const container = el("topRetailersList");
  if (!container) return;

  container.innerHTML = topRetailers.map(r => `
    <div class="ret-item">
      <div class="ret-rank top${r.rank}">${r.rank}</div>
      <div>
        <div class="ret-name">${r.name}</div>
        <div class="ret-orders">${r.orders} orders</div>
      </div>
      <div class="ret-amount">${r.amount}</div>
      <button class="ot-action-btn" style="margin-left:4px">→</button>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════
   UPHAAR SCHEMES
══════════════════════════════════════════════════════════════ */

function buildSchemes() {
  const container = el("schemesList");
  if (!container) return;

  container.innerHTML = schemes.map(s => `
    <div class="scheme-item">
      <div class="scheme-dot"></div>
      <div style="flex:1">
        <div class="scheme-name">${s.name}</div>
        <div class="scheme-meta">${s.retailers > 0 ? `${s.retailers} retailers` : "0 retailers"} · Exp: ${s.expiry}</div>
      </div>
      <div class="scheme-badge">Active</div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════
   AI ALERTS
══════════════════════════════════════════════════════════════ */

function buildAIAlerts() {
  const container = el("aiInsightsList");
  if (!container) return;

  container.innerHTML = aiAlerts.map(a => `
    <div class="alert-card" style="border-left:3px solid ${a.color};background:${a.bg}">
      <div class="alert-head" style="color:${a.color}">
        <span>${a.icon || "AI"}</span>
        <span>${a.type}</span>
      </div>
      <div class="alert-msg">${a.msg}</div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════
   ROLE PILL SWITCHER
══════════════════════════════════════════════════════════════ */

function initRolePills() {
  const pills = document.querySelectorAll(".role-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   SEARCH  (live filter on orders table)
══════════════════════════════════════════════════════════════ */

function initSearch() {
  const input = el("searchInput");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    const rows = document.querySelectorAll("#ordersBody tr");
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   DATE SUBTITLE
══════════════════════════════════════════════════════════════ */

function setDateSubtitle() {
  const sub = el("dateSubtitle");
  if (!sub) return;
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const now = new Date();
  sub.textContent = `Here's your territory overview for today, ${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

/* ══════════════════════════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    setDateSubtitle();
    initSidebar();
    initRolePills();
    initSearch();
    await ensureLogin();
    await loadDashboardData();
    buildTerritoryBars();
    buildOrdersTable();
    buildTopRetailers();
    buildSchemes();
    buildAIAlerts();
    buildRevenueChart();   /* Must come after DOM is ready */
  } catch (error) {
    console.error(error);
    alert(error.message || "Dashboard failed to load");
  }
});

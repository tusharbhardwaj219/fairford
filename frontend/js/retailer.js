/**
 * Fair Ford · Retailer Panel · retailer.js
 * Vanilla JS — connected to Node.js/Express and MongoDB backend.
 * Depends on Chart.js (CDN).
 */

"use strict";

// Auth guard — redirect to login if no token
(function () {
  if (!localStorage.getItem('ff_token')) {
    window.location.replace('/login&signup.html');
  }
})();

// Configuration — when served by the main server, use relative /api paths
const API_URL = '';

/* ══════════════════════════════════════════════════════════════
   DYNAMIC STATE
   ═════════════════════════════════════════════════════════════ */
let purchaseData = [];
let recentOrders = [];
let expiryAlerts = [];
let schemes = [];
let topProducts = [];
let prescriptions = [];
let aiAlerts = [];
let categoryData = [];

let purchaseChartInstance = null;
let categoryChartInstance = null;

const quickActions = [
  { icon: "🛒", label: "Place Order",    id: "qa-order"   },
  { icon: "🚚", label: "Track Orders",   id: "qa-track"   },
  { icon: "📄", label: "Upload Rx",      id: "qa-rx"      },
  { icon: "💳", label: "Pay Now",        id: "qa-pay"     },
  { icon: "📊", label: "View Ledger",    id: "qa-ledger"  },
  { icon: "🎁", label: "My Schemes",     id: "qa-schemes" },
  { icon: "📥", label: "Download Invoice",id: "qa-invoice"},
];

const STATUS_STYLES = {
  Dispatched: { bg: "#dbeafe", color: "#1d4ed8", dot: "#3b82f6" },
  Pending:    { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  Delivered:  { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
  Verified:   { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
  Rejected:   { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" },
  Approved:   { bg: "#ede9fe", color: "#4c1d95", dot: "#8b5cf6" },
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
const el = id => document.getElementById(id);

function fmt(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(2)}K`;
  return `₹${n}`;
}

function statusChip(status) {
  const s = STATUS_STYLES[status] || { bg: "#f1f5f9", color: "#475569", dot: "#94a3b8" };
  return `<span class="status-chip" style="background:${s.bg};color:${s.color}">
    <span class="status-dot" style="background:${s.dot}"></span>${status}
  </span>`;
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADER LAYER
   ══════════════════════════════════════════════════════════════ */
async function loadDashboardData() {
  try {
    // 1. Fetch Retailer info
    const resRetailer = await fetch(`${API_URL}/api/retailer`);
    if (!resRetailer.ok) throw new Error("Could not load retailer info");
    const retailer = await resRetailer.json();

    // 2. Fetch Schemes
    const resSchemes = await fetch(`${API_URL}/api/schemes`);
    schemes = await resSchemes.json();

    // 3. Fetch Prescriptions
    const resPrescriptions = await fetch(`${API_URL}/api/prescriptions`);
    prescriptions = await resPrescriptions.json();

    // 4. Fetch Recent Orders
    const resOrders = await fetch(`${API_URL}/api/orders`);
    recentOrders = await resOrders.json();

    // Update Retailer Stats UI
    el("creditLimitVal").textContent = `₹${retailer.creditLimit.toLocaleString('en-IN')}`;
    el("walletVal").textContent = `₹${retailer.walletBalance.toLocaleString('en-IN')}`;
    el("statOrdersCount").textContent = recentOrders.length;
    el("statTotalPurchases").textContent = `₹${retailer.paidThisMonth.toLocaleString('en-IN')}`;
    el("statOutstandingDue").textContent = `₹${retailer.outstandingDue.toLocaleString('en-IN')}`;
    el("statActiveSchemes").textContent = schemes.length;
    el("statPrescriptions").textContent = prescriptions.length;

    const creditAvailable = retailer.creditLimit - retailer.creditUsed;
    el("statCreditAvailable").textContent = `₹${creditAvailable.toLocaleString('en-IN')}`;

    // Update Payment Summary
    el("summaryOutstanding").textContent = `₹${retailer.outstandingDue.toLocaleString('en-IN')}`;
    el("summaryOverdue").textContent = `₹${retailer.overdueAmount.toLocaleString('en-IN')}`;
    el("summaryPaid").textContent = `₹${retailer.paidThisMonth.toLocaleString('en-IN')}`;
    el("summaryEscrow").textContent = `₹${retailer.escrowBalance.toLocaleString('en-IN')}`;

    // Update Credit Bar
    const pct = retailer.creditLimit > 0 ? Math.round((retailer.creditUsed / retailer.creditLimit) * 100) : 0;
    el("creditUsedText").textContent = `₹${retailer.creditUsed.toLocaleString('en-IN')} / ₹${retailer.creditLimit.toLocaleString('en-IN')}`;
    const fill = el("creditProgressFill");
    if (fill) fill.style.width = `${pct}%`;
    el("creditDetailText").textContent = `${pct}% of credit limit used · ₹${creditAvailable.toLocaleString('en-IN')} available`;

    // 5. Fetch Spending Trends
    const resTrends = await fetch(`${API_URL}/api/dashboard/trends`);
    purchaseData = await resTrends.json();

    // 6. Fetch Categories Spend Distribution
    const resCategories = await fetch(`${API_URL}/api/dashboard/categories`);
    categoryData = await resCategories.json();

    // 7. Fetch Expiry Alerts
    const resExpiry = await fetch(`${API_URL}/api/expiry-alerts`);
    expiryAlerts = await resExpiry.json();

    // 8. Fetch Top Products
    const resTopProducts = await fetch(`${API_URL}/api/products/top`);
    topProducts = await resTopProducts.json();

    // 9. Fetch AI Alerts
    const resAI = await fetch(`${API_URL}/api/ai-alerts`);
    aiAlerts = await resAI.json();

    // Render components
    buildPurchaseChart();
    buildOrdersTable("all");
    buildExpiryList();
    buildSchemes();
    buildTopProducts();
    buildRxSection();
    buildAIAlerts();
    buildCategoryChart();

  } catch (error) {
    console.error("Dashboard fetching error:", error);
    showToast("⚠️ Failed to load dynamic database states.");
  }
}

/* ══════════════════════════════════════════════════════════════
   DATE SUBTITLE
   ══════════════════════════════════════════════════════════════ */
function setDateSubtitle() {
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const now    = new Date();
  const sub    = el("dateSubtitle");
  if (sub) sub.textContent =
    `Here's your store overview for today, ${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR NAV
   ══════════════════════════════════════════════════════════════ */
function initSidebar() {
  const navItems    = document.querySelectorAll(".nav-item");
  const navChildren = document.querySelectorAll(".nav-child");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(i => i.classList.remove("active"));
      navChildren.forEach(c => c.classList.remove("active"));
      item.classList.add("active");

      const group = item.dataset.group;
      if (group) {
        const children = el(`group-${group}`);
        const arrow    = el(`arrow-${group}`);
        if (children) {
          const hidden = children.classList.toggle("hidden");
          if (arrow) arrow.classList.toggle("open", !hidden);
        }
      }
    });
  });

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
   QUICK ACTIONS
   ══════════════════════════════════════════════════════════════ */
function buildQuickActions() {
  const grid = el("quickActionsGrid");
  if (!grid) return;
  grid.innerHTML = quickActions.map(qa => `
    <div class="qa-btn" id="${qa.id}" role="button" tabindex="0">
      <div class="qa-icon">${qa.icon}</div>
      <div class="qa-label">${qa.label}</div>
    </div>
  `).join("");

  // Wire actions
  el("qa-order")  ?.addEventListener("click", openOrderModal);
  el("qa-pay")    ?.addEventListener("click", triggerPaymentPrompt);
  el("qa-invoice")?.addEventListener("click", () => showToast("📥 Downloaded current monthly ledger statements."));
  el("qa-rx")     ?.addEventListener("click", triggerRxUploadPrompt);
  el("qa-track")  ?.addEventListener("click", () => showToast("🚚 Delivery tracking systems updated."));
  el("qa-ledger") ?.addEventListener("click", () => showToast("📄 Opening full distributor account ledger."));
  el("qa-schemes")?.addEventListener("click", () => {
    document.querySelector('[data-nav="Schemes"]')?.click();
    showToast("🎁 Showing active UPHAAR rewards.");
  });
}

/* ══════════════════════════════════════════════════════════════
   PURCHASE TREND CHART (Chart.js)
   ══════════════════════════════════════════════════════════════ */
function buildPurchaseChart() {
  const canvas = el("purchaseChart");
  if (!canvas || purchaseData.length === 0) return;

  if (purchaseChartInstance) {
    purchaseChartInstance.destroy();
  }

  purchaseChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels  : purchaseData.map(d => d.month),
      datasets: [
        {
          label          : "Purchases",
          data           : purchaseData.map(d => d.purchases),
          borderColor    : "#2563eb",
          borderWidth    : 2.5,
          pointRadius    : 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#2563eb",
          fill           : true,
          backgroundColor: ctx => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return "transparent";
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, "rgba(37,99,235,0.2)");
            g.addColorStop(1, "rgba(37,99,235,0.01)");
            return g;
          },
          tension: 0.4,
        },
        {
          label          : "Payments",
          data           : purchaseData.map(d => d.payments),
          borderColor    : "#10b981",
          borderWidth    : 1.8,
          borderDash     : [5, 3],
          pointRadius    : 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#10b981",
          fill           : true,
          backgroundColor: ctx => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return "transparent";
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, "rgba(16,185,129,0.12)");
            g.addColorStop(1, "rgba(16,185,129,0.01)");
            return g;
          },
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff", borderColor: "#e8eaf2", borderWidth: 1,
          titleColor: "#0f1629", bodyColor: "#374151",
          padding: 10, cornerRadius: 8,
          callbacks: {
            label: ctx => ` ₹${(ctx.parsed.y / 100000).toFixed(2)}L`,
          },
        },
      },
      scales: {
        x: {
          grid  : { display: false }, border: { display: false },
          ticks : { color: "#9ca3af", font: { size: 10, family: "'Sora', sans-serif" } },
        },
        y: {
          grid  : { color: "#f1f5f9" }, border: { display: false },
          ticks : {
            color: "#9ca3af",
            font : { size: 10, family: "'Sora', sans-serif" },
            callback: v => `₹${(v / 100000).toFixed(0)}L`,
          },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   CATEGORY DONUT CHART
   ══════════════════════════════════════════════════════════════ */
function buildCategoryChart() {
  const canvas = el("categoryChart");
  if (!canvas || categoryData.length === 0) return;

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  categoryChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels  : categoryData.map(d => d.label),
      datasets: [{
        data           : categoryData.map(d => d.value),
        backgroundColor: categoryData.map(d => d.color),
        borderWidth    : 2,
        borderColor    : "#fff",
        hoverOffset    : 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff", borderColor: "#e8eaf2", borderWidth: 1,
          titleColor: "#0f1629", bodyColor: "#374151",
          padding: 8, cornerRadius: 8,
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` },
        },
      },
    },
  });

  // Legend list builder
  const legend = el("categoryLegend");
  if (legend) {
    legend.innerHTML = categoryData.map(d => `
      <div class="cat-leg-item">
        <div style="display:flex;align-items:center">
          <span class="cat-leg-dot" style="background:${d.color}"></span>
          <span style="color:#374151">${d.label}</span>
        </div>
        <span style="font-family:var(--mono);font-weight:700;font-size:10px;color:#0f1629">${d.value}%</span>
      </div>
    `).join("");
  }
}

/* ══════════════════════════════════════════════════════════════
   ORDERS TABLE
   ══════════════════════════════════════════════════════════════ */
let currentFilter = "all";

function buildOrdersTable(filter) {
  const tbody = el("ordersBody");
  if (!tbody) return;

  const rows = filter === "all"
    ? recentOrders
    : recentOrders.filter(o => o.status === filter);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(o => `
    <tr>
      <td><span class="ot-id">${o.id}</span></td>
      <td>
        <div class="ot-name">${o.name}</div>
        <div class="ot-sub">${o.qty}</div>
      </td>
      <td><span class="ot-amount">${fmt(o.amount)}</span></td>
      <td>${statusChip(o.status)}</td>
      <td style="font-size:11px;color:var(--muted)">${o.delivery}</td>
      <td>
        <button class="ot-action-btn" onclick="showToast('Order details: ${o.name}')">👁</button>
      </td>
    </tr>
  `).join("");
}

function initOrderFilters() {
  const tabs = document.querySelectorAll(".ftab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      buildOrdersTable(currentFilter);
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   EXPIRY ALERTS
   ══════════════════════════════════════════════════════════════ */
function buildExpiryList() {
  const container = el("expiryList");
  if (!container) return;

  container.innerHTML = expiryAlerts.map(e => `
    <div class="expiry-item">
      <div>
        <div class="expiry-name">${e.name}</div>
        <div class="expiry-batch">${e.batch} · ${e.qty}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--muted)">${e.date}</span>
        <span class="expiry-badge exp-${e.risk}">${e.risk.charAt(0).toUpperCase() + e.risk.slice(1)}</span>
      </div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════
   SCHEMES
   ══════════════════════════════════════════════════════════════ */
function buildSchemes() {
  const container = el("schemesList");
  if (!container) return;

  container.innerHTML = schemes.map(s => `
    <div class="scheme-item">
      <div class="scheme-ico">${s.icon || ''}</div>
      <div style="flex:1">
        <div class="scheme-name">${s.name}</div>
        <div class="scheme-meta">${s.meta}</div>
      </div>
      <div class="scheme-save">${s.saving}</div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════
   TOP PRODUCTS
   ══════════════════════════════════════════════════════════════ */
function buildTopProducts() {
  const container = el("topProductsList");
  if (!container) return;

  container.innerHTML = topProducts.map(p => `
    <div class="prod-item">
      <div class="prod-rank r${p.rank}">${p.rank}</div>
      <div style="flex:1">
        <div class="prod-name">${p.name}</div>
        <div class="prod-cat">${p.category} · ${p.qty || 'catalogue'}</div>
      </div>
      <div class="prod-qty">₹${p.price.toLocaleString('en-IN')}</div>
      <button class="prod-reorder" data-name="${p.name}" data-price="${p.price}">↻ Reorder</button>
    </div>
  `).join("");

  // Reorder buttons setup
  container.querySelectorAll(".prod-reorder").forEach(btn => {
    btn.addEventListener("click", () => {
      addToCart(btn.dataset.name, Number(btn.dataset.price));
      openOrderModal();
      showToast(` Added ${btn.dataset.name} to cart!`);
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   PRESCRIPTIONS
   ══════════════════════════════════════════════════════════════ */
function buildRxSection() {
  const rxGrid = el("rxGrid");
  if (rxGrid) {
    const verified = prescriptions.filter(r => r.status === "Verified").length;
    const pending  = prescriptions.filter(r => r.status === "Pending").length;
    const rejected = prescriptions.filter(r => r.status === "Rejected").length;
    rxGrid.innerHTML = `
      <div class="rx-card"><div class="rx-val" style="color:#2563eb">${prescriptions.length + 300}</div><div class="rx-lbl">Uploaded (May)</div></div>
      <div class="rx-card"><div class="rx-val" style="color:#10b981">${verified + 280}</div><div class="rx-lbl">AI Verified</div></div>
      <div class="rx-card"><div class="rx-val" style="color:#f59e0b">${pending}</div><div class="rx-lbl">Pending Review</div></div>
      <div class="rx-card"><div class="rx-val" style="color:#ef4444">${rejected}</div><div class="rx-lbl">Rejected</div></div>
    `;
  }

  // Recent Rx list
  const rxList = el("rxList");
  if (rxList) {
    rxList.innerHTML = prescriptions.slice(0, 4).map(r => `
      <div class="rx-item">
        <div>
          <div class="rx-patient">${r.patient}</div>
          <div class="rx-doc">${r.doc} · ${r.date}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="rx-id">${r.id}</span>
          ${statusChip(r.status)}
        </div>
      </div>
    `).join("");
  }
}

/* ══════════════════════════════════════════════════════════════
   AI ALERTS
   ══════════════════════════════════════════════════════════════ */
function buildAIAlerts() {
  const container = el("aiAlertsList");
  if (!container) return;

  container.innerHTML = aiAlerts.map(a => `
    <div class="alert-card" style="border-left:3px solid ${a.color};background:${a.bg}">
      <div class="alert-head" style="color:${a.color}">
        <span>${a.icon || ''}</span><span>${a.type}</span>
      </div>
      <div class="alert-msg">${a.msg}</div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════
   SEARCH (global filter)
   ══════════════════════════════════════════════════════════════ */
function initSearch() {
  const input = el("searchInput");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll("#ordersBody tr").forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   INTERACTIVE SUBMISSIONS & MODALS
   ══════════════════════════════════════════════════════════════ */
let cartItems = [];

function openOrderModal() {
  el("orderModal").classList.remove("hidden");
  el("productSearch").value = "";
  el("productSuggestions").classList.add("hidden");
  setTimeout(() => el("productSearch").focus(), 50);
}

function closeOrderModal() {
  el("orderModal").classList.add("hidden");
  cartItems = [];
  renderCartItems();
}

async function renderSuggestions(query) {
  const box = el("productSuggestions");
  if (!query.trim()) { box.classList.add("hidden"); return; }

  try {
    const res = await fetch(`${API_URL}/api/products?search=${encodeURIComponent(query)}`);
    const matches = await res.json();

    if (!matches.length) { box.classList.add("hidden"); return; }

    box.innerHTML = matches.slice(0, 6).map(p => `
      <div class="suggestion-item" data-name="${p.name}" data-price="${p.price}" data-unit="${p.unit}">
        <span>${p.name} <span style="font-size:10px;color:var(--muted)">(${p.unit})</span></span>
        <span class="sug-price">₹${p.price}</span>
      </div>
    `).join("");

    box.classList.remove("hidden");

    box.querySelectorAll(".suggestion-item").forEach(item => {
      item.addEventListener("click", () => {
        addToCart(item.dataset.name, Number(item.dataset.price));
        el("productSearch").value = "";
        box.classList.add("hidden");
      });
    });
  } catch (err) {
    console.error("Suggestions retrieval failed:", err);
  }
}

function addToCart(name, price) {
  const existing = cartItems.find(i => i.name === name);
  if (existing) {
    existing.qty++;
  } else {
    cartItems.push({ name, price, qty: 1 });
  }
  renderCartItems();
}

function renderCartItems() {
  const box = el("cartItems");
  if (!box) return;

  if (!cartItems.length) {
    box.innerHTML = `<div class="cart-empty">No items added yet.</div>`;
    el("modalTotal").querySelector(".total-val").textContent = "₹0.00";
    return;
  }

  box.innerHTML = cartItems.map((item, i) => `
    <div class="cart-item">
      <span class="cart-item-name">${item.name}</span>
      <div class="cart-item-qty">
        <span class="qty-btn" data-action="dec" data-idx="${i}">−</span>
        <span class="qty-num">${item.qty}</span>
        <span class="qty-btn" data-action="inc" data-idx="${i}">+</span>
      </div>
      <span class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
      <span class="cart-item-remove" data-idx="${i}">✕</span>
    </div>
  `).join("");

  // Attach control listeners
  box.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === "inc") cartItems[idx].qty++;
      if (action === "dec") {
        cartItems[idx].qty--;
        if (cartItems[idx].qty <= 0) cartItems.splice(idx, 1);
      }
      renderCartItems();
    });
  });

  box.querySelectorAll(".cart-item-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      cartItems.splice(Number(btn.dataset.idx), 1);
      renderCartItems();
    });
  });

  const total = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  el("modalTotal").querySelector(".total-val").textContent =
    `₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function initOrderModal() {
  el("placeOrderBtn")  ?.addEventListener("click", openOrderModal);
  el("quickOrderBtn")  ?.addEventListener("click", openOrderModal);
  el("modalClose")     ?.addEventListener("click", closeOrderModal);
  el("modalCancel")    ?.addEventListener("click", closeOrderModal);

  el("orderModal")?.addEventListener("click", e => {
    if (e.target === el("orderModal")) closeOrderModal();
  });

  el("productSearch")?.addEventListener("input", e => {
    renderSuggestions(e.target.value);
  });

  // POST order to API
  el("modalConfirm")?.addEventListener("click", async () => {
    if (!cartItems.length) {
      showToast(" Please add at least one product.");
      return;
    }

    try {
      const priority = document.querySelector('input[name="priority"]:checked')?.value || 'standard';
      const orderPayload = {
        items: cartItems.map(i => ({ name: i.name, qty: i.qty })),
        priority: priority
      };

      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();

      if (res.ok) {
        closeOrderModal();
        showToast(` Order placed successfully! ID: ${data.id}`);
        await loadDashboardData();
      } else {
        showToast(` ${data.message || 'Payment/Credit limit error.'}`);
      }
    } catch (err) {
      console.error(err);
      showToast(" Server connection failed. Check console.");
    }
  });
}

// Payment prompt trigger
async function triggerPaymentPrompt() {
  const amountStr = prompt("Enter payment amount to pay off outstanding balance (₹):");
  if (!amountStr) return;
  const paymentAmount = parseFloat(amountStr.replace(/,/g, ''));
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    showToast(" Please enter a valid number amount.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/retailer/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentAmount })
    });
    const data = await res.json();

    if (res.ok) {
      showToast(` Payment of ₹${paymentAmount.toLocaleString('en-IN')} confirmed dynamically!`);
      await loadDashboardData();
    } else {
      showToast(` ${data.message || 'Payment processing failed.'}`);
    }
  } catch (err) {
    console.error(err);
    showToast(" Backend connection failed.");
  }
}

// Prescription upload prompt trigger
async function triggerRxUploadPrompt() {
  const patient = prompt("Enter Patient Full Name:");
  if (!patient) return;
  const doc = prompt("Enter Medical Practitioner/Doctor:");
  if (!doc) return;

  try {
    const res = await fetch(`${API_URL}/api/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient, doc })
    });

    if (res.ok) {
      showToast(` Prescription uploaded for ${patient}. Status: Pending AI validation.`);
      await loadDashboardData();
    } else {
      showToast(" Could not log prescription verification request.");
    }
  } catch (err) {
    console.error(err);
    showToast(" Prescription API connection failed.");
  }
}

/* ══════════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════════ */
let toastTimeout = null;

function showToast(msg) {
  const toast = el("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add("hidden"), 3200);
}

/* ══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ══════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  setDateSubtitle();
  initSidebar();
  buildQuickActions();
  initOrderFilters();
  initSearch();
  initOrderModal();
  
  // Wire layout action clicks
  el("payNowBtn")?.addEventListener("click", triggerPaymentPrompt);
  el("downloadInvoiceBtn")?.addEventListener("click", () => showToast(" Current billing summary downloaded."));
  
  // Load dynamic data
  loadDashboardData();

});
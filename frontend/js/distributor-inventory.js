'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const API   = '/api/dist-inventory';
const token = localStorage.getItem('ff_token');
const user  = (() => { try { return JSON.parse(localStorage.getItem('ff_user') || '{}'); } catch { return {}; } })();

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  currentTab: 'overview',
  inv:  { page: 1, pages: 1, total: 0, items: [], search: '', distId: '', status: '' },
  disp: { page: 1, pages: 1, total: 0, items: [], search: '', distId: '', dateFrom: '', dateTo: '' },
  ret:  { page: 1, pages: 1, total: 0, items: [], search: '', distId: '', status: '', dateFrom: '', dateTo: '' },
  ord:  { page: 1, pages: 1, total: 0, items: [], search: '', distId: '', status: '', payment: '', dateFrom: '', dateTo: '' },
  distributors: [],
  products: [],
  drawer: { open: false, productId: null, distributorId: null, batchNumber: null },
};

// ─── API helper ───────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(type, title, msg) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  document.getElementById('toastContainer').prepend(el);
  setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 260); }, 4500);
}

// ─── Date format ──────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─── HTML escape (retailer name/address are user-supplied) ─────────────────────
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

// ─── Order status + payment badges ─────────────────────────────────────────────
function orderStatusBadge(status) {
  const map = {
    pending:    ['badge-pending', 'Pending'],
    approved:   ['badge-info',    'Approved'],
    dispatched: ['badge-info',    'Dispatched'],
    delivered:  ['badge-success', 'Delivered'],
    returned:   ['badge-warning', 'Returned'],
    cancelled:  ['badge-danger',  'Cancelled'],
  };
  const [cls, label] = map[status] || ['badge-info', status || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}
function payBadge(status) {
  const map = {
    paid:    ['badge-success', 'Paid'],
    partial: ['badge-warning', 'Partial'],
    unpaid:  ['badge-danger',  'Unpaid'],
  };
  const [cls, label] = map[status] || ['badge-danger', status || 'Unpaid'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    'In Stock':  ['badge-success', 'In Stock'],
    'Low Stock': ['badge-warning', 'Low Stock'],
    'No Stock':  ['badge-danger',  'No Stock'],
    'Approved':  ['badge-success', 'Approved'],
    'Pending':   ['badge-pending', 'Pending'],
    'Rejected':  ['badge-danger',  'Rejected'],
  };
  const [cls, label] = map[status] || ['badge-info', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ─── Product image cell ───────────────────────────────────────────────────────
function prodCell(name, brand, image, sub) {
  const img = image
    ? `<img class="prod-img" src="${image}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const ph = `<div class="prod-img-placeholder" ${image ? 'style="display:none"' : ''}>💊</div>`;
  return `
    <div class="prod-cell">
      ${img}${ph}
      <div>
        <div class="prod-name">${name || '—'}</div>
        <div class="prod-brand">${brand || ''}</div>
        ${sub ? `<div class="prod-dist">${sub}</div>` : ''}
      </div>
    </div>`;
}

// ─── Pagination renderer ──────────────────────────────────────────────────────
function renderPagination(containerId, page, pages, total, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (pages <= 1) { el.innerHTML = ''; return; }
  const start = (page - 1) * 20 + 1;
  const end   = Math.min(page * 20, total);
  let btns = '';
  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage   = Math.min(pages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) startPage = Math.max(1, endPage - maxVisible + 1);

  if (startPage > 1) btns += `<button class="page-btn" onclick="${onPage}(1)">1</button>`;
  if (startPage > 2) btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
  for (let i = startPage; i <= endPage; i++) {
    btns += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="${onPage}(${i})">${i}</button>`;
  }
  if (endPage < pages - 1) btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
  if (endPage < pages) btns += `<button class="page-btn" onclick="${onPage}(${pages})">${pages}</button>`;

  el.innerHTML = `
    <span class="page-info">Showing ${start}–${end} of ${total}</span>
    <div class="page-btns">
      <button class="page-btn" onclick="${onPage}(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>
      ${btns}
      <button class="page-btn" onclick="${onPage}(${page + 1})" ${page >= pages ? 'disabled' : ''}>›</button>
    </div>`;
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function emptyRow(colspan, icon, title, msg) {
  return `<tr><td colspan="${colspan}">
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${msg}</p>
    </div>
  </td></tr>`;
}

// ════════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ════════════════════════════════════════════════════════════════════════════════
async function loadOverview() {
  await Promise.all([loadKPIs(), loadNotifications(), loadRecentDispatches()]);
}

async function loadKPIs() {
  const grid = document.getElementById('kpiGrid');
  try {
    const { data } = await api('/dashboard');
    const pct = data.totalProductsSent > 0
      ? Math.round((data.totalProductsReturned / data.totalProductsSent) * 100) : 0;

    grid.innerHTML = `
      <div class="kpi-card kpi-blue">
        <div class="kpi-top">
          <div class="kpi-icon">📤</div>
          <span class="kpi-trend flat">↑ Dispatched</span>
        </div>
        <div>
          <div class="kpi-number">${data.totalProductsSent.toLocaleString()}</div>
          <div class="kpi-label">Total Products Sent</div>
        </div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-top">
          <div class="kpi-icon">↩️</div>
          <span class="kpi-trend ${pct > 20 ? 'down' : 'flat'}">${pct}% return rate</span>
        </div>
        <div>
          <div class="kpi-number">${data.totalProductsReturned.toLocaleString()}</div>
          <div class="kpi-label">Total Products Returned</div>
        </div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-top">
          <div class="kpi-icon">📦</div>
          <span class="kpi-trend up">Live</span>
        </div>
        <div>
          <div class="kpi-number">${data.currentRemainingStock.toLocaleString()}</div>
          <div class="kpi-label">Current Remaining Stock</div>
        </div>
      </div>
      <div class="kpi-card kpi-purple">
        <div class="kpi-top">
          <div class="kpi-icon">✅</div>
          <span class="kpi-trend flat">Active</span>
        </div>
        <div>
          <div class="kpi-number">${data.totalActiveProducts.toLocaleString()}</div>
          <div class="kpi-label">Active Inventory Lines</div>
        </div>
      </div>`;
  } catch (e) {
    const isAuth = /token|expired|denied|session|unauthorized/i.test(e.message);
    grid.innerHTML = `
      <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;padding:48px 20px;background:#fff;border-radius:12px;border:1px solid #E2E8F0;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:12px">${isAuth ? '🔐' : '⚠️'}</div>
        <h3 style="margin:0 0 8px;color:#0F4C81;font-size:1.1rem">${isAuth ? 'Admin Login Required' : 'Failed to load dashboard'}</h3>
        <p style="color:#64748B;margin:0 0 20px;font-size:.9rem">${esc(e.message)}</p>
        <a href="/admin.html" style="padding:9px 22px;background:#0F4C81;color:#fff;border-radius:8px;text-decoration:none;font-size:.9rem;font-weight:500">Login as Admin</a>
      </div>`;
  }
}

async function loadNotifications() {
  try {
    const { data } = await api('/notifications');
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifCount');
    const dangers = data.filter(n => n.severity === 'danger').length;
    badge.textContent = data.length;
    badge.style.background = dangers > 0 ? 'var(--danger-bg)' : 'var(--success-bg)';
    badge.style.color       = dangers > 0 ? 'var(--danger)'   : 'var(--success)';
    // Also update tab badge
    const retTab = document.querySelector('.tab-btn[data-tab="returns"]');
    if (retTab && dangers > 0) {
      if (!retTab.querySelector('.tab-badge')) {
        retTab.insertAdjacentHTML('beforeend', `<span class="tab-badge">${dangers}</span>`);
      }
    }

    if (!data.length) {
      list.innerHTML = '<div class="notif-empty">🎉 All good — no alerts right now!</div>';
      return;
    }
    list.innerHTML = data.map(n => `
      <div class="notif-item">
        <div class="notif-dot ${n.severity}"></div>
        <span class="notif-text">${n.message}</span>
        <span class="notif-time">${fmtDate(n.date)}</span>
      </div>`).join('');
  } catch (e) {
    const list = document.getElementById('notifList');
    if (list) list.innerHTML = '<div class="notif-empty">Unable to load notifications.</div>';
  }
}

async function loadRecentDispatches() {
  try {
    const { data } = await api('/dispatch?limit=5&page=1');
    const tbody = document.getElementById('recentDispatchesTbody');
    if (!data.items.length) {
      tbody.innerHTML = emptyRow(5, '📤', 'No dispatches yet', 'Add your first dispatch record to get started.');
      return;
    }
    tbody.innerHTML = data.items.map(d => `
      <tr>
        <td>${prodCell(d.productName, '', d.productImage)}</td>
        <td class="muted">${d.distributorName || '—'}</td>
        <td><span class="batch-tag">${d.invoiceNumber}</span></td>
        <td><span class="qty-value qty-sent">${d.quantitySent.toLocaleString()}</span></td>
        <td class="muted">${fmtDate(d.dispatchDate)}</td>
      </tr>`).join('');
  } catch (e) {
    const tbody = document.getElementById('recentDispatchesTbody');
    const isAuth = /token|expired|denied|session/i.test(e.message);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94A3B8;font-size:.85rem">${isAuth ? '🔐 Login as admin to view dispatches' : '⚠️ ' + esc(e.message)}</td></tr>`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// INVENTORY TABLE
// ════════════════════════════════════════════════════════════════════════════════
async function loadInventory(page = 1) {
  state.inv.page = page;
  const params = new URLSearchParams({
    page,
    limit: 20,
    search:        state.inv.search,
    distributorId: state.inv.distId,
    status:        state.inv.status
  });

  const tbody  = document.getElementById('inventoryTbody');
  const count  = document.getElementById('invResultCount');
  tbody.innerHTML = `<tr><td colspan="8">${[1,2,3].map(() => `<div class="skeleton skel-row"></div>`).join('')}</td></tr>`;

  try {
    const { data } = await api(`/inventory?${params}`);
    state.inv = { ...state.inv, ...data };
    count.innerHTML = `<strong>${data.total.toLocaleString()}</strong> records`;

    if (!data.items.length) {
      tbody.innerHTML = emptyRow(8, '📦', 'No inventory records', 'No products match your current filters.');
    } else {
      tbody.innerHTML = data.items.map(item => {
        const pct = item.totalSent > 0 ? Math.round((item.remaining / item.totalSent) * 100) : 0;
        const barClass = pct > 50 ? 'good' : pct > 10 ? 'caution' : 'bad';
        return `
          <tr>
            <td>${prodCell(item.productName, item.productBrand, item.productImage)}</td>
            <td><span class="batch-tag">${item.batchNumber}</span></td>
            <td>
              <div class="prod-name">${item.distributorName || '—'}</div>
              <div class="prod-brand">${item.distributorCode || ''}</div>
            </td>
            <td><span class="qty-value qty-sent">${item.totalSent.toLocaleString()}</span></td>
            <td><span class="qty-value qty-returned">${item.totalReturned.toLocaleString()}</span></td>
            <td>
              <div class="qty-remaining-wrap">
                <span class="qty-remaining" style="color:var(--${item.remaining<=0?'danger':item.remaining<=50?'warning':'success'})">${item.remaining.toLocaleString()}</span>
              </div>
              <div class="progress-bar-wrap" style="width:80px">
                <div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div>
              </div>
            </td>
            <td>${statusBadge(item.status)}</td>
            <td>
              <div class="row-actions">
                <button class="btn btn-outline btn-sm"
                  onclick="openDrawer('${item.productId}','${item.distributorId}','${item.batchNumber}')">
                  View Details
                </button>
              </div>
            </td>
          </tr>`;
      }).join('');
    }

    renderPagination('invPagination', data.page, data.pages, data.total, 'loadInventory');
  } catch (e) {
    tbody.innerHTML = emptyRow(8, '⚠️', 'Failed to load', e.message);
    toast('error', 'Inventory Load Failed', e.message);
  }
}

function clearInvFilters() {
  document.getElementById('invSearch').value    = '';
  document.getElementById('invDistFilter').value = '';
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.filter-chips .chip[data-status=""]').classList.add('active');
  state.inv.search = ''; state.inv.distId = ''; state.inv.status = '';
  loadInventory(1);
}

// ════════════════════════════════════════════════════════════════════════════════
// DISPATCHES TABLE
// ════════════════════════════════════════════════════════════════════════════════
async function loadDispatches(page = 1) {
  state.disp.page = page;
  const params = new URLSearchParams({
    page,
    limit:         20,
    search:        state.disp.search,
    distributorId: state.disp.distId,
    dateFrom:      state.disp.dateFrom,
    dateTo:        state.disp.dateTo
  });

  const tbody = document.getElementById('dispatchesTbody');
  tbody.innerHTML = `<tr><td colspan="7"><div class="skeleton skel-row"></div></td></tr>`;

  try {
    const { data } = await api(`/dispatch?${params}`);
    state.disp = { ...state.disp, ...data };

    if (!data.items.length) {
      tbody.innerHTML = emptyRow(7, '📤', 'No dispatch records', 'Click "Add Dispatch" to record your first product dispatch.');
      document.getElementById('dispPagination').innerHTML = '';
      return;
    }
    tbody.innerHTML = data.items.map(d => `
      <tr>
        <td>${prodCell(d.productName, '', d.productImage)}</td>
        <td class="muted">${d.distributorName || '—'}</td>
        <td><span class="batch-tag">${d.invoiceNumber}</span></td>
        <td><span class="batch-tag">${d.batchNumber}</span></td>
        <td><span class="qty-value qty-sent">${d.quantitySent.toLocaleString()}</span></td>
        <td class="muted">${fmtDate(d.dispatchDate)}</td>
        <td class="muted" style="font-size:.82rem">${d.remarks || '—'}</td>
      </tr>`).join('');

    renderPagination('dispPagination', data.page, data.pages, data.total, 'loadDispatches');
  } catch (e) {
    tbody.innerHTML = emptyRow(7, '⚠️', 'Load failed', e.message);
    toast('error', 'Load Failed', e.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// RETURNS TABLE
// ════════════════════════════════════════════════════════════════════════════════
async function loadReturns(page = 1) {
  state.ret.page = page;
  const params = new URLSearchParams({
    page,
    limit:         20,
    search:        state.ret.search,
    distributorId: state.ret.distId,
    status:        state.ret.status,
    dateFrom:      state.ret.dateFrom,
    dateTo:        state.ret.dateTo
  });

  const tbody = document.getElementById('returnsTbody');
  tbody.innerHTML = `<tr><td colspan="8"><div class="skeleton skel-row"></div></td></tr>`;

  try {
    const { data } = await api(`/returns?${params}`);
    state.ret = { ...state.ret, ...data };

    if (!data.items.length) {
      tbody.innerHTML = emptyRow(8, '↩️', 'No return records', 'No returns have been recorded yet.');
      document.getElementById('retPagination').innerHTML = '';
      return;
    }
    tbody.innerHTML = data.items.map(r => `
      <tr>
        <td>${prodCell(r.productName, '', r.productImage)}</td>
        <td class="muted">${r.distributorName || '—'}</td>
        <td><span class="batch-tag">${r.batchNumber}</span></td>
        <td><span class="qty-value qty-returned">${r.quantityReturned.toLocaleString()}</span></td>
        <td class="muted">${r.returnReason}</td>
        <td class="muted">${fmtDate(r.returnDate)}</td>
        <td>${statusBadge(r.returnStatus)}</td>
        <td>
          <div class="row-actions">
            ${r.returnStatus === 'Pending'
              ? `<button class="btn btn-success btn-sm" onclick="updateReturn('${r._id}','Approved')">Approve</button>
                 <button class="btn btn-ghost btn-sm" onclick="updateReturn('${r._id}','Rejected')">Reject</button>`
              : `<span style="font-size:.8rem;color:var(--text-muted)">${r.returnStatus}</span>`}
          </div>
        </td>
      </tr>`).join('');

    renderPagination('retPagination', data.page, data.pages, data.total, 'loadReturns');
  } catch (e) {
    tbody.innerHTML = emptyRow(8, '⚠️', 'Load failed', e.message);
    toast('error', 'Load Failed', e.message);
  }
}

async function updateReturn(id, status) {
  try {
    await api(`/returns/${id}`, { method: 'PUT', body: { returnStatus: status } });
    toast('success', `Return ${status}`, 'Status updated successfully.');
    loadReturns(state.ret.page);
    loadKPIs();
    loadNotifications();
  } catch (e) {
    toast('error', 'Update Failed', e.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ORDERS TABLE (retailer orders placed at checkout)
// ════════════════════════════════════════════════════════════════════════════════
async function loadOrders(page = 1) {
  state.ord.page = page;
  const params = new URLSearchParams({
    page, limit: 20,
    search:        state.ord.search,
    status:        state.ord.status,
    paymentStatus: state.ord.payment,
    distributorId: state.ord.distId,
    dateFrom:      state.ord.dateFrom,
    dateTo:        state.ord.dateTo
  });

  const tbody = document.getElementById('ordersTbody');
  const count = document.getElementById('ordResultCount');
  tbody.innerHTML = `<tr><td colspan="8"><div class="skeleton skel-row"></div></td></tr>`;

  try {
    const { data } = await api(`/orders?${params}`);
    state.ord = { ...state.ord, ...data };
    if (count) count.innerHTML = `<strong>${data.total.toLocaleString()}</strong> orders`;

    if (!data.items.length) {
      tbody.innerHTML = emptyRow(8, '🧾', 'No orders', 'No orders match your current filters.');
      document.getElementById('ordPagination').innerHTML = '';
      return;
    }
    tbody.innerHTML = data.items.map(o => `
      <tr>
        <td><span class="batch-tag">${esc(o.orderNumber)}</span></td>
        <td>
          <div class="prod-name">${esc(o.retailerName)}</div>
          <div class="prod-brand">${esc(o.phone || o.city || '')}</div>
        </td>
        <td>
          <div class="prod-name">${o.itemCount} item${o.itemCount === 1 ? '' : 's'}</div>
          <div class="prod-brand ord-items-sum">${esc(o.itemsSummary)}</div>
        </td>
        <td><strong>₹${Number(o.totalAmount).toLocaleString('en-IN')}</strong></td>
        <td>${payBadge(o.paymentStatus)}<div class="prod-brand" style="text-transform:capitalize">${esc(o.paymentMethod)}</div></td>
        <td>${orderStatusBadge(o.status)}</td>
        <td class="muted">${fmtDate(o.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-outline btn-sm" onclick="openOrderDrawer('${o.id}')">View / Manage</button>
          </div>
        </td>
      </tr>`).join('');

    renderPagination('ordPagination', data.page, data.pages, data.total, 'loadOrders');
  } catch (e) {
    tbody.innerHTML = emptyRow(8, '⚠️', 'Load failed', e.message);
    toast('error', 'Orders Load Failed', e.message);
  }
}

function clearOrdFilters() {
  ['ordSearch','ordStatusFilter','ordPayFilter','ordDistFilter','ordDateFrom','ordDateTo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  Object.assign(state.ord, { search: '', status: '', payment: '', distId: '', dateFrom: '', dateTo: '' });
  loadOrders(1);
}

async function openOrderDrawer(id) {
  document.getElementById('drawerTitle').textContent = 'Order Details';
  document.getElementById('productDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  state.drawer.open = true;
  await loadOrderDrawer(id);
}

async function loadOrderDrawer(id) {
  const body = document.getElementById('drawerBody');
  body.innerHTML = `<div style="padding:20px">${[1,2,3].map(() => `<div class="skeleton skel-row" style="margin-bottom:12px"></div>`).join('')}</div>`;
  try {
    const { data: o } = await api(`/orders/${id}`);

    const itemRows = o.items.length
      ? o.items.map(i => `
          <tr>
            <td>${esc(i.name)}${i.brand ? `<div class="prod-brand">${esc(i.brand)}</div>` : ''}</td>
            <td>${i.qty}</td>
            <td>₹${Number(i.unitPrice).toLocaleString('en-IN')}</td>
            <td>₹${Number(i.totalPrice).toLocaleString('en-IN')}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted)">No items</td></tr>`;

    const tlRows = (o.timeline || []).length
      ? o.timeline.slice().reverse().map(t => `
          <div class="ord-tl-item">
            <span class="ord-tl-dot"></span>
            <div><strong style="text-transform:capitalize">${esc(t.status)}</strong>
            <div class="prod-brand">${esc(t.note || '')} · ${fmtDate(t.timestamp)}</div></div>
          </div>`).join('')
      : '<div class="prod-brand">No history yet.</div>';

    // Admin actions: move the order one step forward, or cancel it.
    const terminal = ['delivered', 'cancelled', 'returned'].includes(o.status);
    const nextBtn = {
      pending:    `<button class="btn btn-success btn-sm" onclick="progressOrder('${o.id}','approved')">Approve</button>`,
      approved:   `<button class="btn btn-success btn-sm" onclick="progressOrder('${o.id}','dispatched')">Dispatch</button>`,
      dispatched: `<button class="btn btn-success btn-sm" onclick="progressOrder('${o.id}','delivered')">Mark Delivered</button>`,
    }[o.status] || '';
    const cancelBtn = ['pending', 'approved'].includes(o.status)
      ? `<button class="btn btn-ghost btn-sm" onclick="progressOrder('${o.id}','cancelled')">Cancel Order</button>` : '';
    const payBtn = o.paymentStatus !== 'paid'
      ? `<button class="btn btn-outline btn-sm" onclick="setOrderPayment('${o.id}','paid')">Mark Paid</button>`
      : `<button class="btn btn-outline btn-sm" onclick="setOrderPayment('${o.id}','unpaid')">Mark Unpaid</button>`;

    body.innerHTML = `
      <div class="ord-detail-hdr">
        <div>
          <div class="ord-num">${esc(o.orderNumber)}</div>
          <div class="ord-badges">${orderStatusBadge(o.status)} ${payBadge(o.paymentStatus)}
            <span class="badge badge-info" style="text-transform:capitalize">${esc(o.paymentMethod)}</span></div>
        </div>
        <div class="ord-total">₹${Number(o.totalAmount).toLocaleString('en-IN')}</div>
      </div>

      <div class="drawer-section">
        <h4>Customer Details</h4>
        <div class="ord-info-grid">
          <div class="ord-info"><label>Shop / Name</label><span>${esc(o.retailerName)}</span></div>
          <div class="ord-info"><label>Contact Person</label><span>${esc(o.contactName || '—')}</span></div>
          <div class="ord-info"><label>Phone</label><span>${esc(o.phone || '—')}</span></div>
          <div class="ord-info"><label>Email</label><span>${esc(o.email || '—')}</span></div>
          <div class="ord-info ord-info-wide"><label>Delivery Address</label><span>${esc(o.addressLine || '—')}</span></div>
          <div class="ord-info"><label>GST No.</label><span>${esc(o.gstNumber || '—')}</span></div>
          <div class="ord-info"><label>Drug License</label><span>${esc(o.drugLicense || '—')}</span></div>
          <div class="ord-info"><label>Routed To</label><span>${esc(o.distributorName || '—')}</span></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Items Ordered</h4>
        <div style="overflow-x:auto">
          <table class="mini-table">
            <thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        <div class="ord-totals">
          <div><span>Subtotal</span><strong>₹${Number(o.subtotal).toLocaleString('en-IN')}</strong></div>
          <div><span>GST</span><strong>₹${Number(o.gstAmount).toLocaleString('en-IN')}</strong></div>
          <div class="ord-grand"><span>Total (COD)</span><strong>₹${Number(o.totalAmount).toLocaleString('en-IN')}</strong></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Manage / Distribute</h4>
        ${terminal ? `<p class="prod-brand" style="margin-bottom:10px">This order is ${esc(o.status)} — no further action needed.</p>` : ''}
        <div class="ord-actions">${nextBtn}${cancelBtn}${payBtn}</div>
      </div>

      <div class="drawer-section">
        <h4>History</h4>
        <div class="ord-timeline">${tlRows}</div>
      </div>`;
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Load Failed</h3><p>${esc(e.message)}</p></div>`;
  }
}

async function progressOrder(id, status) {
  if (status === 'cancelled' && !confirm('Cancel this order? Stock will be returned to inventory.')) return;
  try {
    await api(`/orders/${id}/status`, { method: 'PUT', body: { status } });
    toast('success', 'Order Updated', `Order set to ${status}.`);
    loadOrderDrawer(id);
    loadOrders(state.ord.page);
  } catch (e) {
    toast('error', 'Update Failed', e.message);
  }
}

async function setOrderPayment(id, paymentStatus) {
  try {
    await api(`/orders/${id}/payment`, { method: 'PUT', body: { paymentStatus } });
    toast('success', 'Payment Updated', `Marked ${paymentStatus}.`);
    loadOrderDrawer(id);
    loadOrders(state.ord.page);
  } catch (e) {
    toast('error', 'Update Failed', e.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════════
function openDrawer(productId, distributorId, batchNumber) {
  state.drawer = { open: true, productId, distributorId, batchNumber };
  document.getElementById('drawerTitle').textContent = 'Product Detail';
  document.getElementById('productDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  loadDrawerContent(productId, distributorId, batchNumber);
}

function closeDrawer() {
  state.drawer.open = false;
  document.getElementById('productDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function loadDrawerContent(productId, distributorId, batchNumber) {
  const body = document.getElementById('drawerBody');
  body.innerHTML = `<div style="padding:20px">${[1,2,3].map(() => `<div class="skeleton skel-row" style="margin-bottom:12px"></div>`).join('')}</div>`;

  try {
    const { data } = await api(`/product-detail?productId=${productId}&distributorId=${distributorId}&batchNumber=${encodeURIComponent(batchNumber)}`);
    const { product, distributor, inventory, dispatches, returns } = data;

    const remaining = inventory.remaining;
    const pct = inventory.totalSent > 0 ? Math.round((remaining / inventory.totalSent) * 100) : 0;
    const barClass = pct > 50 ? 'good' : pct > 10 ? 'caution' : 'bad';

    const prodImg = product?.image
      ? `<img class="drawer-prod-img" src="${product.image}" alt="${product.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const prodPh = `<div class="drawer-prod-placeholder" ${product?.image ? 'style="display:none"' : ''}>💊</div>`;

    const dispRows = dispatches.length
      ? dispatches.map(d => `
          <tr>
            <td>${fmtDate(d.date)}</td>
            <td><span class="batch-tag">${d.invoiceNumber}</span></td>
            <td><strong>${d.quantitySent}</strong> Units</td>
            <td><span class="batch-tag">${d.batchNumber}</span></td>
            <td style="font-size:.78rem;color:var(--text-muted)">${d.remarks || '—'}</td>
          </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">No dispatch records</td></tr>`;

    const retRows = returns.length
      ? returns.map(r => `
          <tr>
            <td>${fmtDate(r.date)}</td>
            <td><strong>${r.quantityReturned}</strong> Units</td>
            <td>${r.reason}</td>
            <td>${statusBadge(r.status)}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted)">No return records</td></tr>`;

    body.innerHTML = `
      <!-- Product Header -->
      <div class="drawer-product-hdr">
        ${prodImg}${prodPh}
        <div class="drawer-prod-info" style="flex:1">
          <h3>${product?.name || '—'}</h3>
          <p>${product?.brand || ''} ${product?.genericName ? '· ' + product.genericName : ''}</p>
          <div class="drawer-meta">
            <div class="drawer-meta-item"><label>Batch No.</label><span>${batchNumber}</span></div>
            <div class="drawer-meta-item"><label>Distributor</label><span>${distributor?.name || '—'}</span></div>
            <div class="drawer-meta-item"><label>Dist. Code</label><span>${distributor?.code || '—'}</span></div>
            <div class="drawer-meta-item"><label>Mfg Date</label><span>${product?.manufacturingDate || '—'}</span></div>
            <div class="drawer-meta-item"><label>Expiry Date</label><span>${product?.expiryDate || '—'}</span></div>
            <div class="drawer-meta-item"><label>Contact</label><span>${distributor?.email || '—'}</span></div>
          </div>
        </div>
      </div>

      <!-- Inventory Summary -->
      <div class="inv-summary-cards">
        <div class="inv-summary-card sent">
          <div class="label">Total Sent</div>
          <div class="value">${inventory.totalSent.toLocaleString()}</div>
        </div>
        <div class="inv-summary-card returned">
          <div class="label">Total Returned</div>
          <div class="value">${inventory.totalReturned.toLocaleString()}</div>
        </div>
        <div class="inv-summary-card remaining">
          <div class="label">Remaining</div>
          <div class="value">${remaining.toLocaleString()}</div>
        </div>
      </div>
      <div class="progress-bar-wrap" style="margin-bottom:20px">
        <div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div>
      </div>

      <!-- Dispatch History -->
      <div class="drawer-section">
        <h4>Dispatch History</h4>
        <div style="overflow-x:auto">
          <table class="mini-table">
            <thead><tr><th>Date</th><th>Invoice</th><th>Qty Sent</th><th>Batch</th><th>Remarks</th></tr></thead>
            <tbody>${dispRows}</tbody>
          </table>
        </div>
        <div style="margin-top:8px;font-size:.8rem;color:var(--text-muted)">
          Total Dispatched: <strong style="color:var(--primary)">${inventory.totalSent} Units</strong>
        </div>
      </div>

      <!-- Return History -->
      <div class="drawer-section">
        <h4>Return History</h4>
        <div style="overflow-x:auto">
          <table class="mini-table">
            <thead><tr><th>Date</th><th>Qty Returned</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>${retRows}</tbody>
          </table>
        </div>
        <div style="margin-top:8px;font-size:.8rem;color:var(--text-muted)">
          Total Returned (Approved): <strong style="color:var(--warning)">${inventory.totalReturned} Units</strong>
        </div>
      </div>

      <!-- Final Summary -->
      <div class="final-summary">
        <h4>Inventory Summary</h4>
        <div class="final-flow">
          <div class="final-step">
            <div class="num">${inventory.totalSent}</div>
            <div class="lbl">Units Sent</div>
          </div>
          <div class="final-arrow">−</div>
          <div class="final-step">
            <div class="num">${inventory.totalReturned}</div>
            <div class="lbl">Returned</div>
          </div>
          <div class="final-arrow">=</div>
          <div class="final-step">
            <div class="num">${remaining}</div>
            <div class="lbl">Remaining</div>
            <div class="final-remaining-badge">${pct}% remaining</div>
          </div>
        </div>
      </div>`;
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Load Failed</h3><p>${esc(e.message)}</p></div>`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ADD DISPATCH MODAL
// ════════════════════════════════════════════════════════════════════════════════
function openDispatchModal() {
  document.getElementById('dispatchModal').classList.add('open');
  document.getElementById('dispatchForm').reset();
  document.getElementById('dDate').value = todayStr();
  populateDropdowns('dDistributor', 'dProduct');
}
function closeDispatchModal() {
  document.getElementById('dispatchModal').classList.remove('open');
}

async function submitDispatch(e) {
  e.preventDefault();
  const btn = document.getElementById('dispatchSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await api('/dispatch', {
      method: 'POST',
      body: {
        distributorId: document.getElementById('dDistributor').value,
        productId:     document.getElementById('dProduct').value,
        batchNumber:   document.getElementById('dBatch').value.trim(),
        quantitySent:  document.getElementById('dQty').value,
        invoiceNumber: document.getElementById('dInvoice').value.trim(),
        dispatchDate:  document.getElementById('dDate').value,
        remarks:       document.getElementById('dRemarks').value.trim()
      }
    });
    toast('success', 'Dispatch Saved', 'Dispatch record created successfully.');
    closeDispatchModal();
    loadDispatches(1);
    loadKPIs();
    loadRecentDispatches();
    if (state.currentTab === 'inventory') loadInventory(state.inv.page);
  } catch (e) {
    toast('error', 'Save Failed', e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Dispatch`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ADD RETURN MODAL
// ════════════════════════════════════════════════════════════════════════════════
function openReturnModal() {
  document.getElementById('returnModal').classList.add('open');
  document.getElementById('returnForm').reset();
  document.getElementById('rDate').value = todayStr();
  populateDropdowns('rDistributor', 'rProduct');
}
function closeReturnModal() {
  document.getElementById('returnModal').classList.remove('open');
}

async function submitReturn(e) {
  e.preventDefault();
  const btn = document.getElementById('returnSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await api('/returns', {
      method: 'POST',
      body: {
        distributorId:    document.getElementById('rDistributor').value,
        productId:        document.getElementById('rProduct').value,
        batchNumber:      document.getElementById('rBatch').value.trim(),
        quantityReturned: document.getElementById('rQty').value,
        returnReason:     document.getElementById('rReason').value,
        returnDate:       document.getElementById('rDate').value,
        returnStatus:     document.getElementById('rStatus').value,
        remarks:          document.getElementById('rRemarks').value.trim()
      }
    });
    toast('success', 'Return Saved', 'Return record created successfully.');
    closeReturnModal();
    loadReturns(1);
    loadKPIs();
    loadNotifications();
    if (state.currentTab === 'inventory') loadInventory(state.inv.page);
  } catch (e) {
    toast('error', 'Save Failed', e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Return`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// DROPDOWN POPULATION
// ════════════════════════════════════════════════════════════════════════════════
function populateDropdowns(distElId, prodElId) {
  const distEl = document.getElementById(distElId);
  const prodEl = document.getElementById(prodElId);
  if (distEl && state.distributors.length) {
    distEl.innerHTML = `<option value="">Select distributor…</option>` +
      state.distributors.map(d => `<option value="${d._id}">${d.name}${d.businessName ? ' · ' + d.businessName : ''}</option>`).join('');
  }
  if (prodEl && state.products.length) {
    prodEl.innerHTML = `<option value="">Select product…</option>` +
      state.products.map(p => `<option value="${p._id}">${p.name}${p.brand ? ' (' + p.brand + ')' : ''}</option>`).join('');
  }
}

function populateFilterDropdowns() {
  const makeOpts = (arr, none) => {
    return `<option value="">${none}</option>` +
      arr.map(d => `<option value="${d._id}">${d.name}</option>`).join('');
  };
  ['invDistFilter', 'dispDistFilter', 'retDistFilter', 'ordDistFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = makeOpts(state.distributors, 'All Distributors');
  });
}

async function loadReferenceData() {
  try {
    const [dists, prods] = await Promise.all([
      api('/distributors'),
      api('/products')
    ]);
    state.distributors = dists.data || [];
    state.products     = prods.data || [];
    populateFilterDropdowns();
  } catch (e) { /* non-critical */ }
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════════════════════════
async function getAllInventoryForExport() {
  const params = new URLSearchParams({
    page: 1, limit: 1000,
    search:        state.inv.search,
    distributorId: state.inv.distId,
    status:        state.inv.status
  });
  const { data } = await api(`/inventory?${params}`);
  return data.items;
}

function exportCSV() {
  getAllInventoryForExport().then(items => {
    if (!items.length) return toast('warning', 'No Data', 'No inventory records to export.');
    const headers = ['Product', 'Brand', 'Batch No', 'Distributor', 'Sent Qty', 'Returned Qty', 'Remaining Qty', 'Status'];
    const rows = items.map(i => [
      i.productName   || '', i.productBrand  || '',
      i.batchNumber   || '', i.distributorName || '',
      i.totalSent, i.totalReturned, i.remaining, i.status
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `distributor-inventory-${todayStr()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('success', 'CSV Exported', `${items.length} records exported.`);
  }).catch(e => toast('error', 'Export Failed', e.message));
}

function exportExcel() {
  if (!window.XLSX) return toast('error', 'XLSX Not Loaded', 'SheetJS library unavailable.');
  getAllInventoryForExport().then(items => {
    if (!items.length) return toast('warning', 'No Data', 'No inventory records to export.');
    const wsData = [
      ['Product', 'Brand', 'Batch No', 'Distributor', 'Distributor Code', 'Sent Qty', 'Returned Qty', 'Remaining Qty', 'Status', 'Mfg Date', 'Expiry Date'],
      ...items.map(i => [
        i.productName    || '', i.productBrand    || '',
        i.batchNumber    || '', i.distributorName || '', i.distributorCode || '',
        i.totalSent, i.totalReturned, i.remaining, i.status,
        i.manufacturingDate || '', i.expiryDate || ''
      ])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [20,14,12,22,20,10,12,12,12,12,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `distributor-inventory-${todayStr()}.xlsx`);
    toast('success', 'Excel Exported', `${items.length} records exported.`);
  }).catch(e => toast('error', 'Export Failed', e.message));
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════════════════════════════════
function switchTab(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
  if (tabName === 'inventory'  && !state.inv.items.length)  loadInventory(1);
  if (tabName === 'orders'     && !state.ord.items.length)  loadOrders(1);
  if (tabName === 'dispatches' && !state.disp.items.length) loadDispatches(1);
  if (tabName === 'returns'    && !state.ret.items.length)  loadReturns(1);
}

// ════════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════════════════════
async function handleLogout() {
  if (window.showLogoutConfirm) {
    window.showLogoutConfirm(function () {
      // Fire-and-forget API call, then redirect via standard helper
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(function () {});
      window.lcDoLogout('/admin.html');
    });
  } else {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    } catch (_) {}
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    window.location.replace('/admin.html');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// INITIALISATION
// ════════════════════════════════════════════════════════════════════════════════
async function init() {
  // Set user info
  if (user.name) {
    document.getElementById('adminName').textContent = user.name;
    document.getElementById('adminAvatar').textContent = user.name.charAt(0).toUpperCase();
  }

  // Tab click events
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Inventory filters — debounced search
  let invSearchTimer;
  document.getElementById('invSearch').addEventListener('input', e => {
    clearTimeout(invSearchTimer);
    state.inv.search = e.target.value;
    invSearchTimer = setTimeout(() => loadInventory(1), 380);
  });
  document.getElementById('invDistFilter').addEventListener('change', e => {
    state.inv.distId = e.target.value;
    loadInventory(1);
  });
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.inv.status = chip.dataset.status;
      loadInventory(1);
    });
  });

  // Dispatches filters
  let dispSearchTimer;
  document.getElementById('dispSearch').addEventListener('input', e => {
    clearTimeout(dispSearchTimer);
    state.disp.search = e.target.value;
    dispSearchTimer = setTimeout(() => loadDispatches(1), 380);
  });
  document.getElementById('dispDistFilter').addEventListener('change', e => {
    state.disp.distId = e.target.value; loadDispatches(1);
  });
  document.getElementById('dispDateFrom').addEventListener('change', e => {
    state.disp.dateFrom = e.target.value; loadDispatches(1);
  });
  document.getElementById('dispDateTo').addEventListener('change', e => {
    state.disp.dateTo = e.target.value; loadDispatches(1);
  });

  // Returns filters
  let retSearchTimer;
  document.getElementById('retSearch').addEventListener('input', e => {
    clearTimeout(retSearchTimer);
    state.ret.search = e.target.value;
    retSearchTimer = setTimeout(() => loadReturns(1), 380);
  });
  document.getElementById('retDistFilter').addEventListener('change', e => {
    state.ret.distId = e.target.value; loadReturns(1);
  });
  document.getElementById('retStatusFilter').addEventListener('change', e => {
    state.ret.status = e.target.value; loadReturns(1);
  });
  document.getElementById('retDateFrom').addEventListener('change', e => {
    state.ret.dateFrom = e.target.value; loadReturns(1);
  });
  document.getElementById('retDateTo').addEventListener('change', e => {
    state.ret.dateTo = e.target.value; loadReturns(1);
  });

  // Orders filters
  let ordSearchTimer;
  document.getElementById('ordSearch').addEventListener('input', e => {
    clearTimeout(ordSearchTimer);
    state.ord.search = e.target.value;
    ordSearchTimer = setTimeout(() => loadOrders(1), 380);
  });
  document.getElementById('ordStatusFilter').addEventListener('change', e => {
    state.ord.status = e.target.value; loadOrders(1);
  });
  document.getElementById('ordPayFilter').addEventListener('change', e => {
    state.ord.payment = e.target.value; loadOrders(1);
  });
  document.getElementById('ordDistFilter').addEventListener('change', e => {
    state.ord.distId = e.target.value; loadOrders(1);
  });
  document.getElementById('ordDateFrom').addEventListener('change', e => {
    state.ord.dateFrom = e.target.value; loadOrders(1);
  });
  document.getElementById('ordDateTo').addEventListener('change', e => {
    state.ord.dateTo = e.target.value; loadOrders(1);
  });

  // Escape key closes modals/drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeDrawer();
      closeDispatchModal();
      closeReturnModal();
    }
  });
  // Close modals on overlay click
  document.getElementById('dispatchModal').addEventListener('click', e => {
    if (e.target === document.getElementById('dispatchModal')) closeDispatchModal();
  });
  document.getElementById('returnModal').addEventListener('click', e => {
    if (e.target === document.getElementById('returnModal')) closeReturnModal();
  });

  // Guard: data endpoints require a valid admin session
  if (!token) {
    const loginHtml = `
      <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;padding:48px 20px;background:#fff;border-radius:12px;border:1px solid #E2E8F0;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:12px">🔐</div>
        <h3 style="margin:0 0 8px;color:#0F4C81;font-size:1.1rem">Admin Login Required</h3>
        <p style="color:#64748B;margin:0 0 20px;font-size:.9rem">Please log in as an admin or superadmin to access the inventory dashboard.</p>
        <a href="/admin.html" style="padding:9px 22px;background:#0F4C81;color:#fff;border-radius:8px;text-decoration:none;font-size:.9rem;font-weight:500">Login as Admin</a>
      </div>`;
    document.getElementById('kpiGrid').innerHTML = loginHtml;
    document.getElementById('recentDispatchesTbody').innerHTML =
      `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94A3B8;font-size:.85rem">🔐 Login as admin to view dispatches</td></tr>`;
    document.getElementById('notifList').innerHTML =
      `<div class="notif-empty">🔐 Login required to view notifications</div>`;
    document.getElementById('pageLoader').classList.add('hidden');
    return;
  }

  // Load reference data + overview
  await loadReferenceData();
  await loadOverview();

  // Hide loader
  const loader = document.getElementById('pageLoader');
  loader.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);

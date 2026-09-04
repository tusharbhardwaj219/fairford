const API_BASE = '/api/superadmin';

const pages = ['dashboard','approvals','distributors','retailers','documents','products','pricing','wallet','schemes','inventory','analytics','reports','dist-mapping','settings'];

/* ══════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════ */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warn: '⚠',
  };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span style="font-weight:600;margin-right:4px">${icons[type] || '✓'}</span><span>${esc(msg)}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

/* HTML-escape any user-supplied string before it goes into innerHTML.
   Retailer KYC fields (name, city, address, etc.) are attacker-controlled, so
   rendering them raw was a stored-XSS vector into the admin's own session. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

/* Fallback for a product thumbnail whose image URL fails to load (dead/removed
   Cloudinary asset). Replaces the broken <img> with the initial-letter box so
   the table never shows a broken-image icon. Referenced from thumbCell()'s
   inline onerror. */
function thumbFail(img) {
  img.onerror = null;
  const span = document.createElement('span');
  span.className = 'prod-thumb prod-thumb--fallback';
  span.textContent = img.getAttribute('data-initial') || '?';
  img.replaceWith(span);
}

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
function showPage(id) {
  pages.forEach(p => {
    const el = document.getElementById('pg-' + p);
    if (el) el.classList.toggle('active', p === id);
  });
  document.querySelectorAll('.sb-item').forEach(el => {
    el.classList.remove('active');
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes("'" + id + "'")) {
      el.classList.add('active');
    }
  });
  if (window.innerWidth <= 768) closeSidebar();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
  document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════ */
function logout() {
  if (window.showLogoutConfirm) {
    window.showLogoutConfirm(function () {
      window.lcDoLogout('/admin.html');
    });
  } else {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    sessionStorage.removeItem('ff_user');
    window.location.replace('/admin.html');
  }
}

/* ══════════════════════════════════════════
   API HELPER
══════════════════════════════════════════ */
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('ff_token');
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    window.location.replace('/admin.html');
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API ${path} → ${res.status}`);
  }
  return res.json();
}

/* ══════════════════════════════════════════
   CSV DOWNLOAD UTILITY
══════════════════════════════════════════ */
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => {
    let s = String(v == null ? '' : v);
    // Neutralise CSV/Excel formula injection (leading = + - @ tab/CR).
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════
   GLOBAL SEARCH  (highlights matching page)
══════════════════════════════════════════ */
function globalSearch(q) {
  if (!q.trim()) return;
  const lower = q.toLowerCase();
  if (['product','medicine','pharma','drug'].some(k => lower.includes(k))) showPage('products');
  else if (['distributor','dist'].some(k => lower.includes(k))) showPage('distributors');
  else if (['retail','shop','store'].some(k => lower.includes(k))) showPage('retailers');
  else if (['scheme','offer','promo'].some(k => lower.includes(k))) showPage('schemes');
  else if (['inventory','stock','warehouse'].some(k => lower.includes(k))) showPage('inventory');
  else if (['wallet','settle','payment'].some(k => lower.includes(k))) showPage('wallet');
  else if (['price','margin','gst'].some(k => lower.includes(k))) showPage('pricing');
}

/* ══════════════════════════════════════════
   STATE PERFORMANCE (presentational)
══════════════════════════════════════════ */
/* Real state-wise GMV, resolved through each order's retailer shop address and
   supplied by GET /api/superadmin/analytics.

   This was a hardcoded five-state table (Maharashtra ₹38.2L, Karnataka ₹29.5L,
   Delhi ₹22.1L, Tamil Nadu ₹18.7L, Gujarat ₹15.3L) marked "presentational" in
   a comment — but it rendered as a live performance panel with no indication
   the figures were invented. Bars are now relative to the strongest state;
   there is no revenue target in the data model to measure against. */
let states = [];

function renderStatePerf() {
  const targets = [document.getElementById('state-perf'), document.getElementById('analytics-states')];
  targets.forEach(el => {
    if (!el) return;
    if (!states.length) {
      el.innerHTML = '<div class="chart-empty" style="min-height:80px">No order data yet — state performance appears once orders are placed.</div>';
      return;
    }
    el.innerHTML = states.map(s => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:110px;font-size:13px;font-weight:500">${escapeHtml(s.name)}</div>
        <div style="flex:1"><div class="prog-wrap"><div class="prog-bar" style="width:${s.pct}%"></div></div></div>
        <div style="font-size:13px;font-weight:500;width:52px;text-align:right">${s.pct}%</div>
        <div style="font-size:12px;color:var(--text-2);width:74px;text-align:right">₹${Number(s.gmv).toLocaleString('en-IN')}</div>
      </div>`).join('');
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ══════════════════════════════════════════
   DASHBOARD STATS
══════════════════════════════════════════ */
async function loadDashboardStats() {
  try {
    const data = await apiFetch('/dashboard');
    const el = id => document.getElementById(id);
    if (el('stat-distributors')) el('stat-distributors').textContent = data.active_distributors;
    if (el('stat-retailers')) el('stat-retailers').textContent = data.active_retailers.toLocaleString('en-IN');
    if (el('stat-pending')) el('stat-pending').textContent = data.pending_approvals;
    if (el('approval-badge')) el('approval-badge').textContent = data.pending_approvals;
    if (el('pending-badge-count')) el('pending-badge-count').textContent = `${data.pending_approvals} Pending`;
    if (el('alert-text')) el('alert-text').textContent = `${data.pending_approvals} pending user approvals`;
  } catch (e) {
    console.warn('Dashboard stats unavailable:', e.message);
  }
  // Set hero subtitle with live date
  const heroSub = document.getElementById('hero-sub');
  if (heroSub) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    heroSub.textContent = `${days[now.getDay()]}, ${dateStr} · Platform health: Excellent`;
  }
}

/* ══════════════════════════════════════════
   DASHBOARD PENDING WIDGET
══════════════════════════════════════════ */
async function loadPendingWidget() {
  const paList = document.getElementById('pa-list');
  if (!paList) return;
  try {
    const data = await apiFetch('/approvals?status=pending');
    const pending = data.slice(0, 4);
    if (!pending.length) {
      paList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">No pending approvals</div>';
      return;
    }
    paList.innerHTML = '';
    pending.forEach(d => {
      const ini = d.initials || (d.name ? d.name.slice(0,2).toUpperCase() : '??');
      const cc = d.color_class || 'av-pur';
      paList.innerHTML += `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border)">
        <div class="avatar ${cc}">${esc(ini)}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:500">${esc(d.name)}</div><div style="font-size:11px;color:var(--text-3)">${esc(d.type)} · ${esc(d.region)}</div></div>
        <span class="badge badge-amber">Pending</span>
        <button class="btn btn-ghost btn-sm" onclick="showPage('approvals')">Review</button>
      </div>`;
    });
  } catch (e) {
    console.warn('Pending widget unavailable:', e.message);
  }
}

/* ══════════════════════════════════════════
   APPROVALS
══════════════════════════════════════════ */
let allApprovals = [];

async function loadApprovalsTable(filterStatus = 'all') {
  const tbody = document.getElementById('approvals-tbody');
  if (!tbody) return;
  try {
    if (!allApprovals.length) allApprovals = await apiFetch('/approvals');
    renderApprovals(filterStatus === 'all' ? allApprovals : allApprovals.filter(d => d.status === filterStatus));
    updateApprovalTabCounts();
  } catch (e) {
    console.warn('Approvals unavailable:', e.message);
  }
}

function renderApprovals(data) {
  const tbody = document.getElementById('approvals-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">No records found</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  data.forEach(d => {
    const ini = d.initials || (d.name ? d.name.slice(0,2).toUpperCase() : '??');
    const cc = d.color_class || 'av-pur';
    const bc = d.status === 'approved' ? 'badge-green' : d.status === 'rejected' ? 'badge-red' : 'badge-amber';
    const label = d.status.charAt(0).toUpperCase() + d.status.slice(1);
    const btns = d.status === 'pending'
      ? `<button class="btn btn-pri btn-sm" onclick="approveUser('${d.id}',this)">Approve</button>
         <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="rejectUser('${d.id}',this)">Reject</button>`
      : `<span style="font-size:12px;color:var(--text-3)">No action</span>`;
    tbody.innerHTML += `<tr>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar ${cc}">${esc(ini)}</div><strong>${esc(d.name) || '—'}</strong></div></td>
      <td><span class="badge badge-blue">${esc(d.type)}</span></td>
      <td>${esc(d.region)}</td>
      <td style="color:var(--text-2);font-size:12px">${esc(d.submitted)}</td>
      <td style="font-size:12px">${esc(d.docs)}</td>
      <td><span class="badge ${bc} status-badge">${label}</span></td>
      <td>${btns}</td>
    </tr>`;
  });
}

function updateApprovalTabCounts() {
  const counts = {
    all: allApprovals.length,
    pending: allApprovals.filter(d => d.status === 'pending').length,
    approved: allApprovals.filter(d => d.status === 'approved').length,
    rejected: allApprovals.filter(d => d.status === 'rejected').length,
  };
  const tabs = document.querySelectorAll('#approvals-tabs .tab');
  const keys = ['all','pending','approved','rejected'];
  tabs.forEach((tab, i) => {
    const label = keys[i].charAt(0).toUpperCase() + keys[i].slice(1);
    tab.textContent = `${label} (${counts[keys[i]]})`;
  });
}

function filterApprovals(tab, status) {
  document.querySelectorAll('#approvals-tabs .tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const data = status === 'all' ? allApprovals : allApprovals.filter(d => d.status === status);
  renderApprovals(data);
}

async function approveUser(id, btn) {
  try {
    await apiFetch(`/approvals/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
    const idx = allApprovals.findIndex(d => d.id === id);
    if (idx > -1) allApprovals[idx].status = 'approved';
    const badge = btn.closest('tr').querySelector('.status-badge');
    badge.className = 'badge badge-green status-badge';
    badge.textContent = 'Approved';
    btn.parentElement.innerHTML = '<span style="font-size:12px;color:var(--green)">✓ Approved</span>';
    toast('User approved successfully');
    updateApprovalTabCounts();
    loadDashboardStats();
  } catch (e) { toast('Failed to approve user', 'error'); }
}

async function rejectUser(id, btn) {
  try {
    await apiFetch(`/approvals/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'rejected' }) });
    const idx = allApprovals.findIndex(d => d.id === id);
    if (idx > -1) allApprovals[idx].status = 'rejected';
    const badge = btn.closest('tr').querySelector('.status-badge');
    badge.className = 'badge badge-red status-badge';
    badge.textContent = 'Rejected';
    btn.parentElement.innerHTML = '<span style="font-size:12px;color:var(--red)">✕ Rejected</span>';
    toast('User rejected', 'warn');
    updateApprovalTabCounts();
    loadDashboardStats();
  } catch (e) { toast('Failed to reject user', 'error'); }
}

async function bulkApprove() {
  try {
    await apiFetch('/approvals/bulk-approve', { method: 'PUT', body: JSON.stringify({}) });
  } catch (e) { /* fallback: update locally */ }
  allApprovals = allApprovals.map(d => d.status === 'pending' ? { ...d, status: 'approved' } : d);
  renderApprovals(allApprovals);
  updateApprovalTabCounts();
  loadDashboardStats();
  toast('All pending users approved!');
}

/* ══════════════════════════════════════════
   DISTRIBUTORS
══════════════════════════════════════════ */
let allDistributors = [];

async function loadDistributors() {
  const tbody = document.getElementById('dist-tbody');
  if (!tbody) return;
  try {
    allDistributors = await apiFetch('/distributors');
    renderDistributors(allDistributors);
    const active = allDistributors.filter(d => d.status === 'active');
    const el = id => document.getElementById(id);
    if (el('dist-total')) el('dist-total').textContent = allDistributors.length;
    if (el('dist-active')) el('dist-active').textContent = active.length;
    if (el('dist-avg-gmv')) el('dist-avg-gmv').textContent = '₹' + (allDistributors.length ? Math.round(allDistributors.reduce((s, d) => s + parseFloat((d.may_gmv || '0').replace(/[^0-9.]/g,'') || 0), 0) / allDistributors.length * 10) / 10 + 'L' : '0');
  } catch (e) {
    console.warn('Distributors unavailable:', e.message);
  }
}

function renderDistributors(data) {
  const tbody = document.getElementById('dist-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">No distributors found</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  data.forEach(d => {
    const initials = d.initials || (d.name ? d.name.slice(0,2).toUpperCase() : '??');
    const cc = d.color_class || 'av-pur';
    const hasOut = d.outstanding && d.outstanding !== '₹0';
    tbody.innerHTML += `<tr>
      <td><div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="openDistributorProfile('${d.id}')"><div class="avatar ${cc}">${esc(initials)}</div><strong style="color:var(--pri);text-decoration:underline;text-underline-offset:3px">${esc(d.name) || '—'}</strong></div></td>
      <td>${esc(d.state)}</td>
      <td style="text-align:center">${d.retailers_count}</td>
      <td style="font-weight:500">${esc(d.may_gmv)}</td>
      <td style="color:${hasOut ? 'var(--red)' : 'var(--green)'}">${esc(d.outstanding)}</td>
      <td><span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-red'}">${esc(d.status)}</span></td>
      <td class="tbl-actions">
        <button class="btn btn-ghost btn-sm" onclick="openDistributorModal('${d.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteDistributor('${d.id}')">Delete</button>
      </td>
    </tr>`;
  });
}

function filterDistributors() {
  const search = (document.getElementById('dist-search')?.value || '').toLowerCase();
  const state = document.getElementById('dist-state-filter')?.value || '';
  renderDistributors(allDistributors.filter(d =>
    (!search || d.name.toLowerCase().includes(search) || d.state.toLowerCase().includes(search)) &&
    (!state || d.state === state)
  ));
}

let _editingDistId = null;

function openDistributorModal(id = null) {
  _editingDistId = id;
  const modal = document.getElementById('distributorModal');
  const form = document.getElementById('distributorForm');
  if (!modal || !form) return;
  form.reset();
  document.getElementById('distFormTitle').textContent = id ? 'Edit Distributor' : 'Add Distributor';
  document.getElementById('distSubmitBtn').textContent = id ? 'Update Distributor' : 'Add Distributor';
  if (id) {
    const d = allDistributors.find(x => x.id === id);
    if (d) {
      form.querySelector('[name=dist-name]').value = d.name;
      form.querySelector('[name=dist-state]').value = d.state;
      form.querySelector('[name=dist-may-gmv]').value = d.may_gmv || '';
      form.querySelector('[name=dist-outstanding]').value = d.outstanding || '';
      form.querySelector('[name=dist-status]').value = d.status;
    }
  }
  modal.classList.add('active');
}

function closeDistributorModal() {
  document.getElementById('distributorModal')?.classList.remove('active');
}

async function saveDistributor() {
  const form = document.getElementById('distributorForm');
  const name = form.querySelector('[name=dist-name]').value.trim();
  const state = form.querySelector('[name=dist-state]').value.trim();
  if (!name || !state) { toast('Name and State are required', 'error'); return; }
  const payload = {
    name, state,
    initials: name.slice(0, 2).toUpperCase(),
    color_class: 'av-pur',
    may_gmv: form.querySelector('[name=dist-may-gmv]').value || '₹0',
    outstanding: form.querySelector('[name=dist-outstanding]').value || '₹0',
    status: form.querySelector('[name=dist-status]').value,
    retailers_count: 0,
  };
  try {
    if (_editingDistId) {
      await apiFetch(`/distributors/${_editingDistId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Distributor updated');
    } else {
      await apiFetch('/distributors', { method: 'POST', body: JSON.stringify(payload) });
      toast('Distributor added');
    }
    closeDistributorModal();
    allDistributors = [];
    await loadDistributors();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteDistributor(id) {
  if (!confirm('Delete this distributor? This cannot be undone.')) return;
  try {
    await apiFetch(`/distributors/${id}`, { method: 'DELETE' });
    toast('Distributor deleted', 'warn');
    allDistributors = [];
    await loadDistributors();
  } catch (e) { toast('Failed to delete distributor', 'error'); }
}

/* ══════════════════════════════════════════
   RETAILERS
══════════════════════════════════════════ */
let allRetailers = [];

async function loadRetailers() {
  const tbody = document.getElementById('ret-tbody');
  if (!tbody) return;
  try {
    allRetailers = await apiFetch('/retailers');
    renderRetailers(allRetailers);
    const active = allRetailers.filter(r => r.status === 'active');
    const sub = document.getElementById('ret-sub');
    if (sub) sub.textContent = `${active.length.toLocaleString('en-IN')} active retail partners across India`;
  } catch (e) {
    console.warn('Retailers unavailable:', e.message);
  }
}

function renderRetailers(data) {
  const tbody = document.getElementById('ret-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">No retailers found</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  data.forEach(d => {
    tbody.innerHTML += `<tr>
      <td><strong style="color:var(--pri);cursor:pointer;text-decoration:underline;text-underline-offset:3px" onclick="openRetailerProfile('${d.id}')">${esc(d.name)}</strong></td>
      <td style="font-size:12px">${esc(d.city)}</td>
      <td><span class="badge badge-blue">${esc(d.type)}</span></td>
      <td style="font-size:12px">${esc(d.distributor)}</td>
      <td style="text-align:center;font-weight:500">${d.monthly_orders}</td>
      <td style="font-size:12px;color:var(--text-3)">${esc(d.last_order)}</td>
      <td class="tbl-actions">
        <span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-gray'}">${d.status}</span>
        <button class="btn btn-ghost btn-sm" onclick="openRetailerModal('${d.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRetailer('${d.id}')">Delete</button>
      </td>
    </tr>`;
  });
}

function filterRetailers() {
  const search = (document.getElementById('ret-search')?.value || '').toLowerCase();
  const type = document.getElementById('ret-type-filter')?.value || '';
  renderRetailers(allRetailers.filter(d =>
    (!search || d.name.toLowerCase().includes(search) || d.city.toLowerCase().includes(search)) &&
    (!type || d.type === type)
  ));
}

let _editingRetId = null;

function openRetailerModal(id = null) {
  _editingRetId = id;
  const modal = document.getElementById('retailerModal');
  const form = document.getElementById('retailerForm');
  if (!modal || !form) return;
  form.reset();
  document.getElementById('retFormTitle').textContent = id ? 'Edit Retailer' : 'Add Retailer';
  document.getElementById('retSubmitBtn').textContent = id ? 'Update Retailer' : 'Add Retailer';
  if (id) {
    const d = allRetailers.find(x => x.id === id);
    if (d) {
      form.querySelector('[name=ret-name]').value = d.name;
      form.querySelector('[name=ret-city]').value = d.city;
      form.querySelector('[name=ret-type]').value = d.type;
      form.querySelector('[name=ret-distributor]').value = d.distributor;
      form.querySelector('[name=ret-monthly-orders]').value = d.monthly_orders;
      form.querySelector('[name=ret-status]').value = d.status;
    }
  }
  modal.classList.add('active');
}

function closeRetailerModal() {
  document.getElementById('retailerModal')?.classList.remove('active');
}

async function saveRetailer() {
  const form = document.getElementById('retailerForm');
  const name = form.querySelector('[name=ret-name]').value.trim();
  const city = form.querySelector('[name=ret-city]').value.trim();
  if (!name || !city) { toast('Name and City are required', 'error'); return; }
  const payload = {
    name, city,
    type: form.querySelector('[name=ret-type]').value,
    distributor: form.querySelector('[name=ret-distributor]').value,
    monthly_orders: parseInt(form.querySelector('[name=ret-monthly-orders]').value || 0),
    status: form.querySelector('[name=ret-status]').value,
  };
  try {
    if (_editingRetId) {
      await apiFetch(`/retailers/${_editingRetId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Retailer updated');
    } else {
      await apiFetch('/retailers', { method: 'POST', body: JSON.stringify(payload) });
      toast('Retailer added');
    }
    closeRetailerModal();
    allRetailers = [];
    await loadRetailers();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteRetailer(id) {
  if (!confirm('Delete this retailer?')) return;
  try {
    await apiFetch(`/retailers/${id}`, { method: 'DELETE' });
    toast('Retailer deleted', 'warn');
    allRetailers = [];
    await loadRetailers();
  } catch (e) { toast('Failed to delete retailer', 'error'); }
}

/* ══════════════════════════════════════════
   PRODUCTS
══════════════════════════════════════════ */
let allProducts = [];

async function loadProducts() {
  const tbody = document.getElementById('prod-tbody');
  if (!tbody) return;
  try {
    allProducts = await apiFetch('/products');
    renderProducts(allProducts);
  } catch (e) {
    console.warn('Products unavailable:', e.message);
  }
}

function renderProducts(data) {
  const tbody = document.getElementById('prod-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-3);padding:24px">No products found</td></tr>`;
    return;
  }
  // Build thumbnail <td>: real image if uploaded, otherwise an initial-letter
  // placeholder so the column never collapses to whitespace.
  function thumbCell(d) {
    const initial = String(d.name || '?').trim().charAt(0).toUpperCase() || '?';
    if (d.imageUrl) {
      // If the stored image URL 404s (e.g. the Cloudinary asset was removed),
      // onerror swaps in the same initial-letter placeholder instead of showing
      // a broken-image icon. data-initial avoids inline-escaping pitfalls.
      return `<td><img src="${esc(d.imageUrl)}" alt="" class="prod-thumb" loading="lazy" data-initial="${esc(initial)}" onerror="thumbFail(this)"></td>`;
    }
    return `<td><span class="prod-thumb prod-thumb--fallback">${esc(initial)}</span></td>`;
  }
  // data-label is what the responsive "card" view shows next to each cell
  // when the table collapses to a stacked layout on narrow screens.
  tbody.innerHTML = '';
  data.forEach(d => {
    tbody.innerHTML += `<tr>
      ${thumbCell(d)}
      <td data-label="Name"><strong>${esc(d.name)}</strong></td>
      <td data-label="Category"><span class="badge badge-blue">${esc(d.category)}</span></td>
      <td data-label="MRP">₹${Number(d.mrp || 0).toLocaleString('en-IN')}</td>
      <td data-label="Retailer ₹">₹${Number(d.retailerPrice || 0).toLocaleString('en-IN')}</td>
      <td data-label="Distributor ₹">₹${Number(d.distributorPrice || 0).toLocaleString('en-IN')}</td>
      <td data-label="Manufacturer" style="font-size:12px">${esc(d.manufacturer)}</td>
      <td data-label="Stock" style="text-align:center;font-weight:500">${(d.stock || 0).toLocaleString('en-IN')}</td>
      <td data-label="Status"><span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-gray'}">${esc(d.status)}</span></td>
      <td data-label="Added" style="font-size:12px;color:var(--text-3)">${esc(d.created_date)}</td>
      <td class="tbl-actions" data-label="">
        <button class="btn btn-ghost btn-sm" onclick="editProduct('${d.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${d.id}')">Delete</button>
      </td>
    </tr>`;
  });
}

function filterProducts() {
  const search = (document.getElementById('prod-search')?.value || '').toLowerCase();
  const cat = document.getElementById('prod-cat-filter')?.value || '';
  const status = document.getElementById('prod-status-filter')?.value || '';
  renderProducts(allProducts.filter(d =>
    (!search || d.name.toLowerCase().includes(search)) &&
    (!cat || d.category === cat) &&
    (!status || d.status === status)
  ));
}

function openProductModal() {
  const modal = document.getElementById('productModal');
  if (!modal) return;
  document.getElementById('productForm').reset();
  document.getElementById('productFormTitle').textContent = 'Add New Product';
  document.getElementById('submitBtn').textContent = 'Add Product';
  document.getElementById('productId').value = '';
  pigReset();
  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.remove('active');
}

/* ══════════ PRODUCT IMAGE GALLERY MANAGER ══════════
   Owns the 3-slot #pigGrid in the Add/Edit Product modal.
   PIG_SLOTS[i] = null                                   (empty)
              | { kind:'existing', url, public_id }      (already on the product)
              | { kind:'new', file, dataUrl, lowRes }    (freshly chosen, not yet saved)
   Slot 0 is always the primary image. Deleting / reordering compacts the array
   so there are never holes and slot 0 stays primary. On save the array is turned
   into an `imagesPlan` the backend reconciles (see resolveGallery there).
   The gallery is capped at 3 images product-wide (PIG_MAX) — the customer
   product page renders exactly these three slots. */
var PIG_SLOTS = [null, null, null];
var PIG_MAX = 3;
var _pigTargetSlot = -1;   // slot awaiting a file from the shared picker
var _pigDragFrom = -1;

var PIG_CAPTIONS = ['Main product image', 'Back / alternate view', 'Side / product view'];
var PIG_ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function pigReset() { PIG_SLOTS = [null, null, null]; _pigTargetSlot = -1; pigSetProductName(''); pigRender(); }

function pigSetProductName(name) {
  var box = document.getElementById('pigProduct');
  var el = document.getElementById('pigProductName');
  if (!box || !el) return;
  if (name) { el.textContent = name; box.hidden = false; } else { box.hidden = true; }
}

/* Load an existing product's ordered gallery (from getProduct → images[]). */
function pigLoad(images) {
  PIG_SLOTS = [null, null, null];
  (images || []).slice(0, PIG_MAX).forEach(function (img, i) {
    if (img && img.url) PIG_SLOTS[i] = { kind: 'existing', url: img.url, public_id: img.public_id || '' };
  });
  pigRender();
}

function pigCompact() {
  PIG_SLOTS = PIG_SLOTS.filter(Boolean).slice(0, PIG_MAX);
  while (PIG_SLOTS.length < PIG_MAX) PIG_SLOTS.push(null);
}

function pigCount() { return PIG_SLOTS.filter(Boolean).length; }

var PIG_ICONS = {
  plus:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  eye:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  star:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.9 6.26L21.6 9.27l-4.8 4.68 1.13 6.6L12 17.77 6.07 20.55l1.13-6.6-4.8-4.68 6.7-1.01z"/></svg>',
  swap:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  warn:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

function pigRender() {
  var grid = document.getElementById('pigGrid');
  if (!grid) return;
  var anyLowRes = false;
  var html = '';
  for (var i = 0; i < PIG_MAX; i++) {
    var slot = PIG_SLOTS[i];
    var isPrimary = i === 0;
    var cap = PIG_CAPTIONS[i];
    var body;
    if (!slot) {
      body =
        '<button type="button" class="pig-drop" data-pig-add="' + i + '">' +
          '<span class="pig-drop-plus">' + PIG_ICONS.plus + '</span>' +
          '<span class="pig-drop-main">Upload image</span>' +
          '<span class="pig-drop-sub">JPG · PNG · WEBP</span>' +
          '<span class="pig-drop-sub">Drag &amp; drop or click</span>' +
        '</button>';
    } else {
      var src = slot.kind === 'new' ? slot.dataUrl : slot.url;
      if (slot.lowRes) anyLowRes = true;
      body =
        '<div class="pig-preview">' +
          '<img src="' + src + '" alt="' + esc(cap) + '">' +
          (slot.kind === 'new' ? '<span class="pig-preview-badge">' + PIG_ICONS.check + ' New</span>' : '') +
          '<div class="pig-actions">' +
            '<button type="button" class="pig-act pig-act--view" title="Preview" data-pig-view="' + i + '">' + PIG_ICONS.eye + '</button>' +
            (isPrimary ? '' : '<button type="button" class="pig-act pig-act--star" title="Set as primary" data-pig-primary="' + i + '">' + PIG_ICONS.star + '</button>') +
            '<button type="button" class="pig-act pig-act--swap" title="Replace" data-pig-replace="' + i + '">' + PIG_ICONS.swap + '</button>' +
            '<button type="button" class="pig-act pig-act--del" title="Delete" data-pig-del="' + i + '">' + PIG_ICONS.trash + '</button>' +
          '</div>' +
          '<div class="pig-uploading"><span class="pig-spin"></span><span>Uploading…</span></div>' +
        '</div>';
    }
    html +=
      '<div class="pig-slot ' + (isPrimary ? 'pig-slot--primary ' : '') + (slot ? 'pig-filled' : '') + '"' +
        ' data-pig-slot="' + i + '"' + (slot ? ' draggable="true"' : '') + '>' +
        (isPrimary ? '<span class="pig-badge">' + PIG_ICONS.check + ' Primary</span>' : '') +
        body +
        '<div class="pig-slot-cap">' + esc(cap) + (isPrimary ? ' *' : ' <span style="color:var(--text-3)">· optional</span>') + '</div>' +
      '</div>';
  }
  grid.innerHTML = html;

  var cnt = document.getElementById('pigCount');
  if (cnt) cnt.textContent = pigCount() + ' / ' + PIG_MAX;

  // low-res warning strip
  var warn = document.getElementById('pigWarn');
  if (anyLowRes) {
    if (!warn) {
      warn = document.createElement('div');
      warn.id = 'pigWarn'; warn.className = 'pig-warn';
      warn.innerHTML = PIG_ICONS.warn + '<div><b>Low image quality.</b> One or more images are small and may appear blurry on the product page. Upload higher-resolution images (1000×1000px or larger) for the best presentation.</div>';
      grid.parentNode.insertBefore(warn, grid.nextSibling);
    }
  } else if (warn) { warn.remove(); }
}

/* ── file intake ── */
function pigOpenPicker(slotIndex) {
  _pigTargetSlot = slotIndex;
  var input = document.getElementById('pigFileInput');
  if (input) { input.value = ''; input.click(); }
}

function pigValidateFile(file) {
  if (!file) return 'No file selected.';
  var type = (file.type || '').toLowerCase();
  var okType = PIG_ALLOWED.indexOf(type) >= 0 || /\.(png|jpe?g|webp)$/i.test(file.name || '');
  if (!okType) return 'Unsupported image format. Use JPG, PNG or WEBP.';
  if (file.size > 5 * 1024 * 1024) return 'File size is too large. Maximum is 5 MB per image.';
  return '';
}

function pigAcceptFile(slotIndex, file) {
  var err = pigValidateFile(file);
  if (err) { toast(err, 'error'); return; }
  var reader = new FileReader();
  reader.onload = function (ev) {
    var dataUrl = ev.target.result;
    // Detect low resolution (non-blocking warning only).
    var probe = new Image();
    probe.onload = function () {
      var lowRes = Math.min(probe.naturalWidth, probe.naturalHeight) < 600;
      PIG_SLOTS[slotIndex] = { kind: 'new', file: file, dataUrl: dataUrl, lowRes: lowRes };
      pigCompact();
      pigRender();
    };
    probe.onerror = function () {
      PIG_SLOTS[slotIndex] = { kind: 'new', file: file, dataUrl: dataUrl, lowRes: false };
      pigCompact(); pigRender();
    };
    probe.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function pigSetPrimary(i) {
  if (i <= 0 || !PIG_SLOTS[i]) return;
  var s = PIG_SLOTS.splice(i, 1)[0];
  PIG_SLOTS.unshift(s);
  pigCompact();
  pigRender();
  toast('Primary image updated');
}

function pigDelete(i) {
  var wasPrimary = i === 0;
  var others = PIG_SLOTS.filter(Boolean).length;
  pigConfirmDelete(wasPrimary && others > 1, function () {
    PIG_SLOTS[i] = null;
    pigCompact();
    pigRender();
    if (wasPrimary && PIG_SLOTS[0]) toast('Primary image removed — ' + PIG_CAPTIONS[0].toLowerCase() + ' is now the first remaining image');
    else toast('Image removed');
  });
}

/* reorder via drag between slots */
function pigMove(from, to) {
  if (from === to || from < 0 || to < 0) return;
  var arr = PIG_SLOTS.filter(Boolean);
  if (from >= arr.length) return;
  var item = arr.splice(from, 1)[0];
  arr.splice(Math.min(to, arr.length), 0, item);
  PIG_SLOTS = arr.concat([null, null, null]).slice(0, PIG_MAX);
  pigRender();
}

/* delegated events for the grid */
document.addEventListener('click', function (e) {
  var add = e.target.closest && e.target.closest('[data-pig-add]');
  if (add) { pigOpenPicker(Number(add.getAttribute('data-pig-add'))); return; }
  var rep = e.target.closest && e.target.closest('[data-pig-replace]');
  if (rep) { pigOpenPicker(Number(rep.getAttribute('data-pig-replace'))); return; }
  var del = e.target.closest && e.target.closest('[data-pig-del]');
  if (del) { pigDelete(Number(del.getAttribute('data-pig-del'))); return; }
  var pri = e.target.closest && e.target.closest('[data-pig-primary]');
  if (pri) { pigSetPrimary(Number(pri.getAttribute('data-pig-primary'))); return; }
  var view = e.target.closest && e.target.closest('[data-pig-view]');
  if (view) { var s = PIG_SLOTS[Number(view.getAttribute('data-pig-view'))]; if (s) pigPreview(s.kind === 'new' ? s.dataUrl : s.url); return; }
});

document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'pigFileInput') {
    var file = e.target.files && e.target.files[0];
    if (file && _pigTargetSlot >= 0) pigAcceptFile(_pigTargetSlot, file);
    _pigTargetSlot = -1;
    e.target.value = '';
  }
});

/* drag & drop: files from the OS onto an empty slot, and reordering between slots */
document.addEventListener('dragstart', function (e) {
  var slot = e.target.closest && e.target.closest('.pig-slot.pig-filled');
  if (!slot) return;
  _pigDragFrom = filledIndexOf(Number(slot.getAttribute('data-pig-slot')));
  slot.classList.add('pig-drag-src');
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragend', function () {
  _pigDragFrom = -1;
  document.querySelectorAll('.pig-slot').forEach(function (s) { s.classList.remove('pig-drag-src', 'pig-dragover'); });
});
document.addEventListener('dragover', function (e) {
  var slot = e.target.closest && e.target.closest('.pig-slot');
  if (!slot) return;
  e.preventDefault();
  slot.classList.add('pig-dragover');
});
document.addEventListener('dragleave', function (e) {
  var slot = e.target.closest && e.target.closest('.pig-slot');
  if (slot) slot.classList.remove('pig-dragover');
});
document.addEventListener('drop', function (e) {
  var slot = e.target.closest && e.target.closest('.pig-slot');
  if (!slot) return;
  e.preventDefault();
  slot.classList.remove('pig-dragover');
  var slotIndex = Number(slot.getAttribute('data-pig-slot'));
  // Dropped OS files → upload into the first free slot (or the targeted one).
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    var target = PIG_SLOTS[slotIndex] ? firstFreeSlot() : slotIndex;
    if (target >= 0) pigAcceptFile(target, e.dataTransfer.files[0]);
    return;
  }
  // Reorder within the grid.
  if (_pigDragFrom >= 0) { pigMove(_pigDragFrom, filledIndexOf(slotIndex)); _pigDragFrom = -1; }
});
function firstFreeSlot() { for (var i = 0; i < PIG_MAX; i++) if (!PIG_SLOTS[i]) return i; return -1; }
function filledIndexOf(slotIndex) {
  // slotIndex is a visual index; with compaction it equals the filled index,
  // but clamp to the number of filled slots for safety.
  var filled = PIG_SLOTS.filter(Boolean).length;
  return Math.min(slotIndex, Math.max(0, filled - 1));
}

/* ── confirm + preview overlays ── */
function pigEnsureOverlays() {
  if (!document.getElementById('pigConfirm')) {
    var c = document.createElement('div');
    c.className = 'pig-modal'; c.id = 'pigConfirm';
    c.innerHTML =
      '<div class="pig-modal-card">' +
        '<div class="pig-modal-ico">' + PIG_ICONS.trash + '</div>' +
        '<h3 id="pigConfirmTitle">Delete product image?</h3>' +
        '<p id="pigConfirmBody">Are you sure you want to remove this image? This cannot be undone once you save the product.</p>' +
        '<div class="pig-modal-actions">' +
          '<button type="button" class="btn btn-ghost" id="pigConfirmCancel">Cancel</button>' +
          '<button type="button" class="btn btn-danger" id="pigConfirmOk">Delete image</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(c);
    c.addEventListener('click', function (e) { if (e.target === c) pigCloseConfirm(); });
    document.getElementById('pigConfirmCancel').addEventListener('click', pigCloseConfirm);
  }
  if (!document.getElementById('pigLightbox')) {
    var lb = document.createElement('div');
    lb.className = 'pig-lightbox'; lb.id = 'pigLightbox';
    lb.innerHTML = '<button type="button" class="pig-lightbox-close" aria-label="Close">×</button><img id="pigLightboxImg" alt="Product image preview">';
    document.body.appendChild(lb);
    lb.addEventListener('click', function () { lb.classList.remove('on'); });
  }
}
var _pigConfirmCb = null;
function pigConfirmDelete(isPrimary, cb) {
  pigEnsureOverlays();
  _pigConfirmCb = cb;
  var body = document.getElementById('pigConfirmBody');
  body.textContent = isPrimary
    ? 'This is the primary image. If you remove it, the next image becomes the new primary. Continue?'
    : 'Are you sure you want to remove this image? This cannot be undone once you save the product.';
  var ok = document.getElementById('pigConfirmOk');
  ok.onclick = function () { pigCloseConfirm(); if (_pigConfirmCb) _pigConfirmCb(); _pigConfirmCb = null; };
  document.getElementById('pigConfirm').classList.add('on');
}
function pigCloseConfirm() { var c = document.getElementById('pigConfirm'); if (c) c.classList.remove('on'); }
function pigPreview(src) {
  pigEnsureOverlays();
  document.getElementById('pigLightboxImg').src = src;
  document.getElementById('pigLightbox').classList.add('on');
}

/* Build the multipart body for save: text payload + imagesPlan + new files. */
function pigBuildFormData(payload) {
  var fd = new FormData();
  Object.keys(payload).forEach(function (k) {
    if (payload[k] !== null && payload[k] !== undefined) fd.append(k, payload[k]);
  });
  var plan = [];
  var fileIdx = 0;
  PIG_SLOTS.filter(Boolean).slice(0, PIG_MAX).forEach(function (slot) {
    if (slot.kind === 'existing') {
      plan.push({ keep: slot.public_id });
    } else if (slot.kind === 'new') {
      var field = 'image_' + (fileIdx++);
      fd.append(field, slot.file);
      plan.push({ file: field });
    }
  });
  fd.append('imagesPlan', JSON.stringify(plan));
  return fd;
}

async function editProduct(id) {
  try {
    const product = await apiFetch(`/products/${id}`);
    const form = document.getElementById('productForm');
    form.querySelector('[name=product-name]').value     = product.name || '';
    form.querySelector('[name=product-cat]').value      = product.category || '';
    form.querySelector('[name=product-mrp]').value      = product.mrp ?? '';
    form.querySelector('[name=product-retail]').value   = product.retailerPrice ?? '';
    form.querySelector('[name=product-dist]').value     = product.distributorPrice ?? '';
    form.querySelector('[name=product-mfr]').value      = product.manufacturer || '';
    form.querySelector('[name=product-stock]').value    = product.stock ?? '';
    form.querySelector('[name=product-strength]').value = product.strength || '';
    form.querySelector('[name=product-pack]').value     = product.packSize || '';
    form.querySelector('[name=product-dosage]').value   = product.dosageForm || '';
    form.querySelector('[name=product-desc]').value     = product.description || '';
    form.querySelector('[name=product-status]').value   = product.status || 'active';
    document.getElementById('productId').value = id;
    document.getElementById('productFormTitle').textContent = 'Edit Product';
    document.getElementById('submitBtn').textContent = 'Update Product';
    // Load the product's existing gallery into the 3-slot manager (pigLoad caps
    // at PIG_MAX, so a legacy 4th image simply isn't loaded and is dropped on
    // the next save). Kept images stay untouched unless the admin removes them.
    pigSetProductName(product.name || '');
    pigLoad(product.images || (product.imageUrl ? [{ url: product.imageUrl }] : []));
    document.getElementById('productModal').classList.add('active');
  } catch (e) { toast('Failed to load product', 'error'); }
}

async function saveProduct() {
  const form = document.getElementById('productForm');
  const productId = document.getElementById('productId').value;
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
  const payload = {
    name:             form.querySelector('[name=product-name]').value.trim(),
    category:         form.querySelector('[name=product-cat]').value,
    mrp:              numOrNull(form.querySelector('[name=product-mrp]').value),
    retailerPrice:    numOrNull(form.querySelector('[name=product-retail]').value),
    distributorPrice: numOrNull(form.querySelector('[name=product-dist]').value),
    manufacturer:     form.querySelector('[name=product-mfr]').value.trim() || 'Fair Ford Pharma',
    strength:         form.querySelector('[name=product-strength]').value.trim(),
    packSize:         form.querySelector('[name=product-pack]').value.trim(),
    dosageForm:       form.querySelector('[name=product-dosage]').value.trim(),
    stock:            parseInt(form.querySelector('[name=product-stock]').value || '0', 10),
    description:      form.querySelector('[name=product-desc]').value,
    status:           form.querySelector('[name=product-status]').value,
  };
  // The 3 prices are required by the storefront; reject early with a clear toast.
  if (payload.mrp == null || payload.retailerPrice == null || payload.distributorPrice == null) {
    toast('MRP, Retailer Price and Distributor Price are all required', 'error');
    return;
  }

  // The primary product image is required when creating a new product.
  if (!productId && pigCount() === 0) {
    toast('Please add at least the primary product image', 'error');
    return;
  }

  const url = productId ? `/products/${productId}` : '/products';
  const method = productId ? 'PUT' : 'POST';

  const submitBtn = document.getElementById('submitBtn');
  const origBtnText = submitBtn.textContent;
  submitBtn.disabled = true;

  // Always multipart: the backend reads `imagesPlan` (+ image_N files) to
  // reconcile the whole gallery. New files may be large, so send via XHR to
  // show a real upload-progress bar (fetch can't report upload progress).
  const fd = pigBuildFormData(payload);
  const hasNewFiles = PIG_SLOTS.filter(Boolean).some(s => s.kind === 'new');
  submitBtn.textContent = hasNewFiles ? 'Uploading…' : (productId ? 'Updating…' : 'Adding…');

  const progress = pigProgressEl();
  if (hasNewFiles && progress) { progress.wrap.classList.add('on'); progress.bar.style.width = '0%'; }

  try {
    await pigXhrSave(API_BASE + url, method, fd, function (pct) {
      if (progress) progress.bar.style.width = pct + '%';
    });
    toast(productId ? 'Product updated successfully' : 'Product added successfully');
    closeProductModal();
    allProducts = [];
    await loadProducts();
  } catch (e) {
    if (e && e.unauth) {
      localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user');
      window.location.replace('/admin.html'); return;
    }
    toast((e && e.message) || 'Save failed', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origBtnText;
    if (progress) { progress.wrap.classList.remove('on'); progress.bar.style.width = '0%'; }
  }
}

/* Aggregate save-progress bar under the gallery grid (created lazily). */
function pigProgressEl() {
  var grid = document.getElementById('pigGrid');
  if (!grid) return null;
  var wrap = document.getElementById('pigProgress');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'pigProgress'; wrap.className = 'pig-progress';
    wrap.innerHTML = '<div class="pig-progress-bar"></div>';
    grid.parentNode.insertBefore(wrap, grid.nextSibling);
  }
  return { wrap: wrap, bar: wrap.querySelector('.pig-progress-bar') };
}

/* XHR multipart upload with progress. Resolves on 2xx, rejects otherwise. */
function pigXhrSave(fullUrl, method, formData, onProgress) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, fullUrl);
    var token = localStorage.getItem('ff_token');
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    }
    xhr.onload = function () {
      if (xhr.status === 401 || xhr.status === 403) { reject({ unauth: true }); return; }
      if (xhr.status >= 200 && xhr.status < 300) { if (onProgress) onProgress(100); resolve(); return; }
      var msg = 'HTTP ' + xhr.status;
      try { var b = JSON.parse(xhr.responseText || '{}'); msg = b.error || b.message || msg; } catch (_) {}
      reject(new Error(msg));
    };
    xhr.onerror = function () { reject(new Error('Network error during upload')); };
    xhr.send(formData);
  });
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await apiFetch(`/products/${id}`, { method: 'DELETE' });
    toast('Product deleted', 'warn');
    allProducts = [];
    await loadProducts();
  } catch (e) { toast('Failed to delete product', 'error'); }
}

/* ══════════════════════════════════════════
   PRICING
══════════════════════════════════════════ */
let allPricingRules = [];

async function loadPricingTable() {
  const tbody = document.getElementById('pricing-tbody');
  if (!tbody) return;
  try {
    allPricingRules = await apiFetch('/pricing');
    tbody.innerHTML = '';
    if (!allPricingRules.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:24px">No rules found</td></tr>`;
      return;
    }
    allPricingRules.forEach(r => {
      const sc = r.status === 'active' ? 'badge-green' : r.status === 'pending' ? 'badge-amber' : 'badge-gray';
      tbody.innerHTML += `<tr>
        <td><strong>${esc(r.category)}</strong></td>
        <td>${r.dist_margin}%</td>
        <td>${r.retail_margin}%</td>
        <td>${esc(r.gst_rate)}</td>
        <td><span class="badge ${sc}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
      </tr>`;
    });
  } catch (e) {
    console.warn('Pricing unavailable:', e.message);
  }
}

async function savePricingRule(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    category: form.querySelector('[name=pricing-cat]').value,
    channel: form.querySelector('[name=pricing-channel]').value,
    mrp: parseFloat(form.querySelector('[name=pricing-mrp]').value),
    dist_margin: parseFloat(form.querySelector('[name=pricing-dist]').value),
    retail_margin: parseFloat(form.querySelector('[name=pricing-retail]').value),
    gst_rate: form.querySelector('[name=pricing-gst]').value,
    status: 'active',
  };
  try {
    await apiFetch('/pricing', { method: 'POST', body: JSON.stringify(payload) });
    await loadPricingTable();
    toast('Pricing rule saved!');
  } catch (e) { toast(e.message, 'error'); }
}

/* ── PRODUCT-LEVEL PRICING ──────────────────────────────────────────────
   Prices live on the Product itself (distributorPrice/retailerPrice/mrp/gst),
   which the storefront already reads — so there is NO separate price table.
   This panel selects a product, loads its prices, and PUTs the price fields
   back via the existing product-update endpoint (partial patch). Category
   margin rules (above) are untouched and act as defaults. */
let ppProducts = [];

async function loadProductPricing() {
  try {
    const list = await apiFetch('/products');
    ppProducts = (list || []).map(p => ({
      id: p.id || p._id, name: p.name,
      category: p.category || p.categoryName || '',
      pts: p.distributorPrice, ptr: p.retailerPrice, mrp: p.mrp, gst: p.gst,
      status: p.status || 'active',
    }));
    renderProductPricingTable();
    wireProductPriceSearch();
  } catch (e) { console.warn('Product pricing unavailable:', e.message); }
}

function renderProductPricingTable() {
  const tb = document.getElementById('pp-tbody');
  if (!tb) return;
  const q = (document.getElementById('ppFilter') ? document.getElementById('ppFilter').value : '').trim().toLowerCase();
  const rows = ppProducts.filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  if (!rows.length) { tb.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-3);padding:24px">No products found</td></tr>`; return; }
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  tb.innerHTML = rows.map(p => {
    const sc = p.status === 'active' ? 'badge-green' : p.status === 'inactive' ? 'badge-amber' : 'badge-gray';
    return `<tr>
      <td><strong>${esc(p.name)}</strong></td>
      <td>${esc(p.category || '—')}</td>
      <td>${money(p.pts)}</td><td>${money(p.ptr)}</td><td>${money(p.mrp)}</td>
      <td>${(p.gst != null && p.gst !== '') ? p.gst + '%' : '—'}</td>
      <td><span class="badge ${sc}">${(p.status || 'active').charAt(0).toUpperCase() + (p.status || 'active').slice(1)}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="editProductPrice('${p.id}')">Edit</button></td>
    </tr>`;
  }).join('');
}

function wireProductPriceSearch() {
  const input = document.getElementById('ppSearch'), box = document.getElementById('ppSuggest');
  if (!input || !box || input._ppWired) return;
  input._ppWired = true;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { box.hidden = true; return; }
    const m = ppProducts.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 8);
    box.innerHTML = m.length
      ? m.map(p => `<div class="pp-sug" onclick="selectPricingProduct('${p.id}')">${esc(p.name)}<span>${esc(p.category || '')}</span></div>`).join('')
      : `<div class="pp-sug pp-sug--empty">No matching product</div>`;
    box.hidden = false;
  });
  document.addEventListener('click', e => { if (!input.contains(e.target) && !box.contains(e.target)) box.hidden = true; });
}

function selectPricingProduct(id) {
  const p = ppProducts.find(x => x.id === id);
  if (!p) return;
  const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v; };
  set('ppSearch', p.name); set('ppProductId', id); set('ppCategory', p.category || '—');
  set('ppPts', p.pts != null ? p.pts : ''); set('ppPtr', p.ptr != null ? p.ptr : ''); set('ppMrp', p.mrp != null ? p.mrp : '');
  set('ppGst', (p.gst == null || p.gst === '') ? '' : String(p.gst));
  set('ppStatus', p.status || 'active');
  const box = document.getElementById('ppSuggest'); if (box) box.hidden = true;
}

function editProductPrice(id) {
  selectPricingProduct(id);
  const el = document.getElementById('ppSearch');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetProductPrice() {
  ['ppSearch', 'ppProductId', 'ppCategory', 'ppPts', 'ppPtr', 'ppMrp'].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
  const g = document.getElementById('ppGst'); if (g) g.value = '';
  const s = document.getElementById('ppStatus'); if (s) s.value = 'active';
}

async function saveProductPrice(e) {
  e.preventDefault();
  const id = document.getElementById('ppProductId').value;
  const pts = parseFloat(document.getElementById('ppPts').value);
  const ptr = parseFloat(document.getElementById('ppPtr').value);
  const mrp = parseFloat(document.getElementById('ppMrp').value);
  const gstRaw = document.getElementById('ppGst').value;
  const status = document.getElementById('ppStatus').value;

  if (!id) return toast('Please select a product first', 'error');
  if (isNaN(pts) || isNaN(ptr) || isNaN(mrp)) return toast('PTS, PTR and MRP are required and must be numbers', 'error');
  if (pts < 0 || ptr < 0 || mrp < 0) return toast('Prices cannot be negative', 'error');
  if (!(pts <= ptr && ptr <= mrp)) return toast('Pricing must satisfy PTS ≤ PTR ≤ MRP', 'error');

  const payload = { distributorPrice: pts, retailerPrice: ptr, mrp: mrp, status };
  if (gstRaw !== '') payload.gst = parseFloat(gstRaw);
  try {
    await apiFetch('/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    toast('Price saved for this product');
    await loadProductPricing();
    selectPricingProduct(id);   // keep it selected with fresh values
  } catch (err) { toast(err.message || 'Failed to save price', 'error'); }
}

/* ══════════════════════════════════════════
   WALLET
══════════════════════════════════════════ */
async function loadWallet() {
  const tbody = document.getElementById('wallet-tbody');
  if (!tbody) return;
  try {
    const data = await apiFetch('/wallet');
    tbody.innerHTML = '';
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:24px">No settlements found</td></tr>`;
      return;
    }
    data.forEach(d => {
      const ini = d.initials || (d.distributor ? d.distributor.slice(0,2).toUpperCase() : '??');
      const cc = d.color_class || 'av-pur';
      const { badge, label, btn } = settlementUI(d);
      tbody.innerHTML += `<tr>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar ${cc}">${esc(ini)}</div>${esc(d.distributor) || '—'}</div></td>
        <td style="font-family:var(--ff-font-mono, ui-monospace, Menlo, monospace);font-size:12px">${esc(d.invoice_no)}</td>
        <td style="font-weight:500">${esc(d.amount)}</td>
        <td>${esc(d.due_date)}</td>
        <td><span class="badge ${badge}">${label}</span></td>
        <td>${btn(d.id)}</td>
      </tr>`;
    });
  } catch (e) {
    console.warn('Wallet unavailable:', e.message);
  }
}

function settlementUI(d) {
  const map = {
    overdue:   { badge: 'badge-red',    label: 'Overdue',   btn: id => `<button class="btn btn-pri btn-sm" onclick="settleNow('${id}',this)">Settle Now</button>` },
    due_today: { badge: 'badge-amber',  label: 'Due Today', btn: id => `<button class="btn btn-pri btn-sm" onclick="settleNow('${id}',this)">Settle Now</button>` },
    pending:   { badge: 'badge-amber',  label: 'Pending',   btn: id => `<button class="btn btn-pri btn-sm" onclick="settleNow('${id}',this)">Settle Now</button>` },
    escrow:    { badge: 'badge-purple', label: 'In Escrow', btn: () => `<button class="btn btn-ghost btn-sm">Review</button>` },
    settled:   { badge: 'badge-green',  label: 'Settled',   btn: () => `<button class="btn btn-ghost btn-sm">Receipt</button>` },
  };
  return map[d.status] || map['settled'];
}

async function settleNow(id, btn) {
  try {
    await apiFetch(`/wallet/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'settled' }) });
    const row = btn.closest('tr');
    const badge = row.querySelector('.badge');
    badge.className = 'badge badge-green';
    badge.textContent = 'Settled';
    btn.parentElement.innerHTML = '<button class="btn btn-ghost btn-sm">Receipt</button>';
    toast('Settlement completed');
  } catch (e) { toast('Settlement failed', 'error'); }
}

async function bulkSettlement() {
  if (!confirm('Settle all pending/overdue invoices now?')) return;
  try {
    const data = await apiFetch('/wallet');
    const actionable = data.filter(d => ['overdue','due_today','pending'].includes(d.status));
    if (!actionable.length) { toast('No pending settlements', 'info'); return; }
    await Promise.all(actionable.map(d =>
      apiFetch(`/wallet/${d.id}`, { method: 'PUT', body: JSON.stringify({ status: 'settled' }) })
    ));
    await loadWallet();
    toast(`${actionable.length} settlements completed`);
  } catch (e) { toast('Bulk settlement failed', 'error'); }
}

/* ══════════════════════════════════════════
   SCHEMES
══════════════════════════════════════════ */
async function loadSchemes() {
  const list = document.getElementById('schemes-list');
  if (!list) return;
  try {
    const data = await apiFetch('/schemes');
    list.innerHTML = '';
    if (!data.length) {
      list.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-3)">No schemes found</div>';
      return;
    }
    const borderColors = { active: 'var(--pri)', upcoming: 'var(--green)', ended: 'var(--amber)' };
    const progClass = { active: '', upcoming: 'prog-green', ended: 'prog-amber' };
    data.forEach(s => {
      const bc = borderColors[s.status] || 'var(--text-3)';
      const pc = progClass[s.status] || '';
      const pct = s.target > 0 ? Math.min(100, Math.round((s.redemptions / s.target) * 100)) : 0;
      const badgeClass = s.status === 'active' ? 'badge-green' : s.status === 'upcoming' ? 'badge-amber' : 'badge-gray';
      const dateLabel = s.status === 'upcoming' ? `Starts ${formatDate(s.start_date)}` : `Ends ${formatDate(s.end_date)}`;
      list.innerHTML += `<div class="card" style="border-top:3px solid ${bc}">
        <div class="card-header"><span class="card-title">${esc(s.name)}</span><span class="badge ${badgeClass}">${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span></div>
        <div class="card-body">
          <div style="font-size:12px;color:var(--text-2);margin-bottom:10px">${esc(s.description || s.type + ' · ' + s.category)}</div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span style="color:var(--text-2)">Redemptions</span><strong>${s.redemptions.toLocaleString('en-IN')}</strong></div>
          <div class="prog-wrap"><div class="prog-bar ${pc}" style="width:${pct}%"></div></div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">Target: ${s.target.toLocaleString('en-IN')} · ${dateLabel}</div>
        </div>
      </div>`;
    });
  } catch (e) {
    console.warn('Schemes unavailable:', e.message);
  }
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function focusSchemeForm() {
  const form = document.getElementById('schemeForm');
  if (!form) return;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => form.querySelector('[name=scheme-name]')?.focus(), 400);
}

async function publishScheme(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.querySelector('[name=scheme-name]').value.trim(),
    type: form.querySelector('[name=scheme-type]').value,
    category: form.querySelector('[name=scheme-cat]').value,
    channel: form.querySelector('[name=scheme-channel]').value,
    start_date: form.querySelector('[name=scheme-start]').value,
    end_date: form.querySelector('[name=scheme-end]').value,
  };
  try {
    await apiFetch('/schemes', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    await loadSchemes();
    toast('Scheme published!');
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════════════════════════════════════
   INVENTORY
══════════════════════════════════════════ */
let allInventory = [];

async function loadInventory() {
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;
  try {
    allInventory = await apiFetch('/inventory');
    renderInventory(allInventory);
  } catch (e) {
    console.warn('Inventory unavailable:', e.message);
  }
}

function renderInventory(data) {
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">No inventory found</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  data.forEach(d => {
    const sc = d.status === 'ok' ? 'badge-green' : d.status === 'low' ? 'badge-amber' : 'badge-red';
    tbody.innerHTML += `<tr>
      <td><strong>${esc(d.product_name)}</strong></td>
      <td><span class="badge badge-blue">${esc(d.category)}</span></td>
      <td>${d.total_stock.toLocaleString('en-IN')}</td>
      <td style="color:var(--text-2)">${d.reserved.toLocaleString('en-IN')}</td>
      <td style="font-weight:500">${d.available.toLocaleString('en-IN')}</td>
      <td style="color:var(--text-3)">${d.reorder_level.toLocaleString('en-IN')}</td>
      <td><span class="badge ${sc}">${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span></td>
    </tr>`;
  });
}

function filterInventory() {
  const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
  renderInventory(allInventory.filter(d =>
    !search ||
    d.product_name.toLowerCase().includes(search) ||
    d.category.toLowerCase().includes(search)
  ));
}

function exportInventoryCSV() {
  if (!allInventory.length) { toast('No inventory data to export', 'error'); return; }
  const rows = [
    ['Product Name','Category','Total Stock','Reserved','Available','Reorder Level','Status'],
    ...allInventory.map(d => [d.product_name,d.category,d.total_stock,d.reserved,d.available,d.reorder_level,d.status]),
  ];
  downloadCSV(rows, 'inventory-export.csv');
  toast('Inventory exported');
}

/* ══════════════════════════════════════════
   DIST MAPPING
══════════════════════════════════════════ */
let allMappings = [];

async function loadDistMapping() {
  const tbody = document.getElementById('mapping-tbody');
  if (!tbody) return;
  try {
    allMappings = await apiFetch('/dist-mapping');
    renderMappings(allMappings);
  } catch (e) {
    console.warn('Dist-mapping unavailable:', e.message);
  }
}

function renderMappings(data) {
  const tbody = document.getElementById('mapping-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">No mappings found</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  data.forEach(d => {
    const ini = d.initials || (d.distributor ? d.distributor.slice(0,2).toUpperCase() : '??');
    const cc = d.color_class || 'av-pur';
    tbody.innerHTML += `<tr>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar ${cc}">${esc(ini)}</div>${esc(d.distributor) || '—'}</div></td>
      <td>${esc(d.state) || '—'}</td>
      <td>${esc(d.district) || '—'}</td>
      <td>${d.retailers_mapped}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="prog-wrap" style="width:80px"><div class="prog-bar" style="width:${d.coverage_pct}%"></div></div>${d.coverage_pct}%</div></td>
      <td style="color:var(--text-3);font-size:12px">${esc(d.last_updated)}</td>
      <td class="tbl-actions">
        <button class="btn btn-ghost btn-sm" onclick="openMappingModal('${d.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMapping('${d.id}')">Delete</button>
      </td>
    </tr>`;
  });
}

function filterMappings() {
  const search = (document.getElementById('map-search')?.value || '').toLowerCase();
  renderMappings(allMappings.filter(d =>
    !search || d.distributor.toLowerCase().includes(search) || d.state.toLowerCase().includes(search)
  ));
}

let _editingMapId = null;

function openMappingModal(id = null) {
  _editingMapId = id;
  const modal = document.getElementById('mappingModal');
  const form = document.getElementById('mappingForm');
  if (!modal || !form) return;
  form.reset();
  document.getElementById('mappingFormTitle').textContent = id ? 'Edit Mapping' : 'New Mapping';
  document.getElementById('mappingSubmitBtn').textContent = id ? 'Update Mapping' : 'Create Mapping';
  if (id) {
    const d = allMappings.find(x => x.id === id);
    if (d) {
      form.querySelector('[name=map-distributor]').value = d.distributor;
      form.querySelector('[name=map-state]').value = d.state;
      form.querySelector('[name=map-district]').value = d.district;
      form.querySelector('[name=map-retailers]').value = d.retailers_mapped;
      form.querySelector('[name=map-coverage]').value = d.coverage_pct;
    }
  }
  modal.classList.add('active');
}

function closeMappingModal() {
  document.getElementById('mappingModal')?.classList.remove('active');
}

async function saveMapping() {
  const form = document.getElementById('mappingForm');
  const distributor = form.querySelector('[name=map-distributor]').value.trim();
  const state = form.querySelector('[name=map-state]').value.trim();
  if (!distributor || !state) { toast('Distributor and State are required', 'error'); return; }
  const payload = {
    distributor, state,
    district: form.querySelector('[name=map-district]').value,
    retailers_mapped: parseInt(form.querySelector('[name=map-retailers]').value || 0),
    coverage_pct: parseFloat(form.querySelector('[name=map-coverage]').value || 0),
    initials: distributor.slice(0, 2).toUpperCase(),
    color_class: 'av-pur',
  };
  try {
    if (_editingMapId) {
      await apiFetch(`/dist-mapping/${_editingMapId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Mapping updated');
    } else {
      await apiFetch('/dist-mapping', { method: 'POST', body: JSON.stringify(payload) });
      toast('Mapping created');
    }
    closeMappingModal();
    allMappings = [];
    await loadDistMapping();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteMapping(id) {
  if (!confirm('Delete this mapping?')) return;
  try {
    await apiFetch(`/dist-mapping/${id}`, { method: 'DELETE' });
    toast('Mapping deleted', 'warn');
    allMappings = [];
    await loadDistMapping();
  } catch (e) { toast('Failed to delete mapping', 'error'); }
}

/* ══════════════════════════════════════════
   REPORTS EXPORT
══════════════════════════════════════════ */
async function exportReport(type) {
  const config = {
    // Was a fixed table of invented monthly GMV and "target" figures — it
    // downloaded as a CSV indistinguishable from a real report. Now built from
    // the same real aggregation the charts use. There is no target anywhere in
    // the data model, so that column is gone rather than fabricated.
    gmv: {
      rows: () => {
        const m = (window.SA_ANALYTICS && window.SA_ANALYTICS.months) || [];
        const rows = [['Month','GMV (INR)','Orders']];
        m.forEach(r => rows.push([r.label, r.gmv, r.orders]));
        return rows;
      },
      file: 'gmv-report.csv',
      label: 'GMV report',
    },
    users: {
      rows: () => {
        const rows = [['Name','Type','City / State','Distributor','Monthly Orders','Status']];
        allRetailers.forEach(r => rows.push([r.name,'Retailer',r.city,r.distributor,r.monthly_orders,r.status]));
        allDistributors.forEach(d => rows.push([d.name,'Distributor',d.state,'—',d.retailers_count,d.status]));
        return rows;
      },
      file: 'user-acquisition.csv',
      label: 'User acquisition report',
    },
    // Was a header row and nothing else — the button downloaded an empty file.
    // There is no in-page cache for wallet rows, so fetch on demand.
    settlement: {
      rows: async () => {
        const rows = [['Distributor','Invoice','Amount','Due Date','Status']];
        const data = await apiFetch('/wallet');
        (Array.isArray(data) ? data : []).forEach(r =>
          rows.push([r.distributor, r.invoice_no, r.amount, r.due_date, r.status]));
        return rows;
      },
      file: 'settlement-report.csv',
      label: 'Settlement report',
    },
    inventory: {
      rows: () => {
        const rows = [['Product','Category','Total Stock','Reserved','Available','Reorder Level','Status']];
        allInventory.forEach(d => rows.push([d.product_name,d.category,d.total_stock,d.reserved,d.available,d.reorder_level,d.status]));
        return rows;
      },
      file: 'inventory-report.csv',
      label: 'Inventory report',
    },
    // Also header-only before. Redemption/target counters do not exist on the
    // Scheme model, so those columns are dropped rather than filled with zeros
    // that would read as real performance data.
    schemes: {
      rows: async () => {
        const rows = [['Scheme','Type','Category','Channel','Status','Start','End']];
        const data = await apiFetch('/schemes');
        (Array.isArray(data) ? data : []).forEach(s =>
          rows.push([s.name, s.type, s.category, s.channel, s.status, s.start_date, s.end_date]));
        return rows;
      },
      file: 'scheme-performance.csv',
      label: 'Scheme performance report',
    },
    states: {
      // `states` is now loaded from the analytics endpoint, so this reads real
      // figures — but it must be a function, or it would capture the empty
      // array at module-evaluation time, before the fetch resolves.
      rows: () => {
        const rows = [['State','GMV (INR)','Share of top state %']];
        states.forEach(s => rows.push([s.name, s.gmv, s.pct + '%']));
        return rows;
      },
      file: 'state-report.csv',
      label: 'State-wise report',
    },
  };

  const exp = config[type];
  if (!exp) return;
  try {
    // Some builders now fetch, so await regardless — await on a plain array is
    // a no-op.
    const rows = await (typeof exp.rows === 'function' ? exp.rows() : exp.rows);
    if (!rows || rows.length <= 1) {
      toast(`No data available for the ${exp.label.toLowerCase()}`, 'error');
      return;
    }
    downloadCSV(rows, exp.file);
    toast(`${exp.label} downloaded`);
  } catch (e) {
    toast(`Could not build the ${exp.label.toLowerCase()}`, 'error');
  }
}

/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
function saveSettings(e) {
  e.preventDefault();
  const form = document.getElementById('settingsForm');
  const settings = {
    platform_name: form.querySelector('[name=setting-name]')?.value,
    currency: form.querySelector('[name=setting-currency]')?.value,
    gst_number: form.querySelector('[name=setting-gst]')?.value,
    timezone: form.querySelector('[name=setting-timezone]')?.value,
  };
  // There is no settings endpoint on the API, so this only ever reached
  // localStorage — one browser, one admin, no effect on the platform. The old
  // message ("Settings saved successfully") implied a system-wide change, which
  // matters when the fields include the platform GST number.
  localStorage.setItem('fairford_settings', JSON.stringify(settings));
  toast('Saved to this browser only — not yet applied platform-wide', 'error');
}

function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('fairford_settings') || '{}');
    const form = document.getElementById('settingsForm');
    if (!form || !Object.keys(settings).length) return;
    if (settings.platform_name) form.querySelector('[name=setting-name]').value = settings.platform_name;
    if (settings.currency) form.querySelector('[name=setting-currency]').value = settings.currency;
    if (settings.gst_number) form.querySelector('[name=setting-gst]').value = settings.gst_number;
  } catch (_) {}

  // Restore notification toggle states
  try {
    document.querySelectorAll('.toggle[data-key]').forEach(el => {
      const val = localStorage.getItem(el.dataset.key);
      if (val !== null) {
        el.classList.toggle('on', val === '1');
        el.classList.toggle('off', val !== '1');
      }
    });
  } catch (_) {}
}

function toggleNotification(el) {
  const isOn = el.classList.contains('on');
  el.classList.toggle('on', !isOn);
  el.classList.toggle('off', isOn);
  if (el.dataset.key) localStorage.setItem(el.dataset.key, isOn ? '0' : '1');
  toast(isOn ? 'Notification disabled' : 'Notification enabled', isOn ? 'warn' : 'success');
}

/* ══════════════════════════════════════════
   CHARTS
══════════════════════════════════════════ */
/* Charts run on REAL order data from GET /api/superadmin/analytics.

   They previously ran on hardcoded arrays: monthly GMV of [85,92,78,104,122,156]
   in lakh, a fixed [90,90,90,110,110,150] "target" line, and a fixed category
   split. Against the actual book — 19 orders totalling ~41k — those figures
   overstated the business by roughly two orders of magnitude, on the screen the
   company's own management reads. The "Export" buttons wrote them to CSV too.

   There is no target/forecast anywhere in the data model, so the target series
   is gone rather than invented. Where a chart has too little data to be
   meaningful, an explicit message replaces it instead of a padded trend. */

window.SA_ANALYTICS = null;

function saChartEmpty(canvas, msg) {
  if (!canvas || !canvas.parentNode) return;
  const note = document.createElement('div');
  note.className = 'chart-empty';
  note.textContent = msg;
  canvas.parentNode.replaceChild(note, canvas);
}

function saInr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

async function initAnalyticsCharts() {
  let a;
  try {
    a = await apiFetch('/analytics');
  } catch (e) {
    // apiFetch redirects on 401/403; anything else leaves the charts unbuilt
    // rather than falling back to invented numbers.
    ['gmvChart', 'revChart', 'catDonut'].forEach(id =>
      saChartEmpty(document.getElementById(id), 'Analytics could not be loaded.'));
    return;
  }
  window.SA_ANALYTICS = a;

  // State panel shares this payload rather than making a second request.
  states = (a && a.states) || [];
  if (typeof renderStatePerf === 'function') renderStatePerf();

  const months = (a && a.months) || [];
  const cats   = (a && a.categories) || [];
  const labels = months.map(m => m.label);
  const gmv    = months.map(m => m.gmv);

  const axisMoney = {
    grid: { color: '#F0EFF8' },
    ticks: { color: '#A09BBF', font: { size: 11 }, callback: v => '₹' + Number(v).toLocaleString('en-IN') },
  };

  // ── Dashboard: GMV by month ────────────────────────────────────────────────
  const gmvCtx = document.getElementById('gmvChart');
  if (gmvCtx) {
    if (!months.length) {
      saChartEmpty(gmvCtx, 'No orders yet — GMV will appear here once orders are placed.');
    } else {
      new Chart(gmvCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'GMV', data: gmv, backgroundColor: '#5B3EE8', borderRadius: 6, borderSkipped: false }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => saInr(c.parsed.y) } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#A09BBF', font: { size: 11 } } },
            y: axisMoney,
          },
        },
      });
    }
  }

  // ── Analytics: revenue trend ───────────────────────────────────────────────
  const revCtx = document.getElementById('revChart');
  if (revCtx) {
    if (months.length < 2) {
      saChartEmpty(revCtx, months.length
        ? 'Only one month of order data so far — a trend needs at least two.'
        : 'No orders yet — the revenue trend will appear once orders are placed.');
    } else {
      new Chart(revCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Revenue', data: gmv, borderColor: '#5B3EE8', backgroundColor: 'rgba(91,62,232,.08)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#5B3EE8' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => saInr(c.parsed.y) } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#A09BBF', font: { size: 11 } } },
            y: axisMoney,
          },
        },
      });
    }
  }

  // ── Analytics: revenue by category ─────────────────────────────────────────
  const catCtx = document.getElementById('catDonut');
  if (catCtx) {
    if (!cats.length) {
      saChartEmpty(catCtx, 'No order lines yet.');
    } else {
      new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: cats.map(c => c.label),
          datasets: [{
            data: cats.map(c => c.value),
            backgroundColor: ['#5B3EE8', '#0FA86A', '#D97B0A', '#E24B4A', '#A09BBF', '#7C6FF0'],
            borderWidth: 0,
          }],
        },
        options: {
          cutout: '68%', maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => c.label + ': ' + saInr(c.parsed) } },
          },
        },
      });
    }
  }
}

/* Wallet settlement split — real counts from GET /api/superadmin/wallet, which
   derives each order's settlement state from its payment/dispatch status. The
   donut and its legend were previously fixed at 74/16/10 percent. */
async function initWalletDonut() {
  const ctx = document.getElementById('walletDonut');
  if (!ctx) return;

  let rows;
  try {
    rows = await apiFetch('/wallet');
  } catch (e) {
    saChartEmpty(ctx, 'Unavailable');
    return;
  }
  if (!Array.isArray(rows) || !rows.length) {
    saChartEmpty(ctx, 'No orders yet');
    ['wdSettled', 'wdTransit', 'wdPending'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0%';
    });
    return;
  }

  // settlementStatus() yields: settled | due_today | overdue | pending.
  // due_today/overdue both mean "dispatched or delivered, not yet paid".
  const buckets = { settled: 0, transit: 0, pending: 0 };
  rows.forEach(r => {
    if (r.status === 'settled') buckets.settled++;
    else if (r.status === 'due_today' || r.status === 'overdue') buckets.transit++;
    else buckets.pending++;
  });

  const total = rows.length;
  const pct = n => Math.round((n / total) * 100) + '%';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('wdSettled', pct(buckets.settled));
  set('wdTransit', pct(buckets.transit));
  set('wdPending', pct(buckets.pending));

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Settled', 'In transit', 'Pending'],
      datasets: [{
        data: [buckets.settled, buckets.transit, buckets.pending],
        backgroundColor: ['#0FA86A', '#5B3EE8', '#E24B4A'],
        borderWidth: 0, hoverOffset: 4,
      }],
    },
    options: {
      cutout: '68%', maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.label}: ${c.parsed} order${c.parsed === 1 ? '' : 's'}` } },
      },
    },
  });
}

window.addEventListener('load', initAnalyticsCharts);
window.addEventListener('load', initWalletDonut);


/* ══════════════════════════════════════════
   DISTRIBUTOR PROFILE
══════════════════════════════════════════ */
async function openDistributorProfile(id) {
  const modal = document.getElementById('distProfileModal');
  const content = document.getElementById('distProfileContent');
  if (!modal || !content) return;
  content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3);font-size:13px">Loading profile…</div>';
  modal.classList.add('active');
  try {
    const distName = (allDistributors.find(x => x.id === id) || {}).name || '';
    const [d, inventory] = await Promise.all([
      apiFetch(`/distributors/${id}`),
      apiFetch(`/inventory?distributor=${encodeURIComponent(distName)}`),
    ]);
    const ini = d.initials || (d.name ? d.name.slice(0, 2).toUpperCase() : '??');
    const cc = d.color_class || 'av-pur';
    const lowStock = inventory.filter(i => i.status === 'low' || i.status === 'critical');
    const statusBadge = d.status === 'active' ? 'badge-green' : d.status === 'suspended' ? 'badge-amber' : 'badge-red';
    const invRows = inventory.map(i => {
      const sc = i.status === 'ok' ? 'badge-green' : i.status === 'low' ? 'badge-amber' : 'badge-red';
      const rowStyle = (i.status === 'low' || i.status === 'critical') ? 'background:var(--amber-bg)' : '';
      return `<tr style="${rowStyle}">
        <td><strong style="font-size:12px">${esc(i.product_name)}</strong></td>
        <td style="text-align:center">${i.total_stock.toLocaleString('en-IN')}</td>
        <td style="text-align:center;font-weight:600">${i.available.toLocaleString('en-IN')}</td>
        <td style="text-align:center">${i.reorder_level.toLocaleString('en-IN')}</td>
        <td><span class="badge ${sc}">${esc(i.status)}</span></td>
      </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="profile-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
            <div class="profile-avatar-lg">${ini}</div>
            <div style="min-width:0">
              <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</div>
              <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:rgba(255,255,255,.75)">
                ${d.phone ? `<span>📞 ${esc(d.phone)}</span>` : ''}
                ${d.email ? `<span>✉ ${esc(d.email)}</span>` : ''}
                ${d.city ? `<span>📍 ${esc(d.city)}, ${esc(d.state)}</span>` : `<span>📍 ${esc(d.state) || '—'}</span>`}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span class="badge ${statusBadge}">${d.status ? d.status.charAt(0).toUpperCase() + d.status.slice(1) : '—'}</span>
            <button class="profile-close-btn" onclick="closeDistProfile()">×</button>
          </div>
        </div>
      </div>

      <div class="profile-stats-row">
        <div class="profile-stat">
          <div class="profile-stat-val">${d.may_gmv || '—'}</div>
          <div class="profile-stat-label">May GMV</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val">${d.retailers_count ?? '—'}</div>
          <div class="profile-stat-label">Retailers</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val" style="${d.outstanding && d.outstanding !== '₹0' ? 'color:var(--red)' : 'color:var(--green)'}">${d.outstanding || '₹0'}</div>
          <div class="profile-stat-label">Outstanding</div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Business Information</div>
        <div class="profile-grid">
          <div>
            <div class="profile-field-label">GSTIN</div>
            <div class="profile-field-val" style="font-family:var(--ff-font-mono, ui-monospace, Menlo, monospace);font-size:12px">${d.gstin || '—'}</div>
          </div>
          <div>
            <div class="profile-field-label">Drug License No.</div>
            <div class="profile-field-val" style="font-family:var(--ff-font-mono, ui-monospace, Menlo, monospace);font-size:12px">${d.license_no || '—'}</div>
          </div>
          <div>
            <div class="profile-field-label">Member Since</div>
            <div class="profile-field-val">${d.joined || '—'}</div>
          </div>
          <div>
            <div class="profile-field-label">State / Territory</div>
            <div class="profile-field-val">${d.state || '—'}</div>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Address</div>
        <div style="font-size:13px;color:var(--text);line-height:1.7">
          ${d.address ? `${d.address}<br>${[d.city, d.pincode].filter(Boolean).join(' — ')}<br>${d.state || ''}` : '<span style="color:var(--text-3)">No address on file</span>'}
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title" style="display:flex;align-items:center;gap:8px">
          Inventory
          ${lowStock.length ? `<span class="badge badge-red" style="font-size:10px">${lowStock.length} low stock</span>` : (inventory.length ? '<span class="badge badge-green" style="font-size:10px">All OK</span>' : '')}
        </div>
        ${lowStock.length ? `
          <div class="low-stock-banner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>${lowStock.length} item${lowStock.length > 1 ? 's' : ''} below reorder level — immediate restocking needed</span>
          </div>` : ''}
        ${inventory.length ? `
          <div class="inv-tbl-wrap">
            <table class="data">
              <thead><tr><th>Product</th><th style="text-align:center">Total</th><th style="text-align:center">Available</th><th style="text-align:center">Reorder</th><th>Status</th></tr></thead>
              <tbody>${invRows}</tbody>
            </table>
          </div>` : `<div style="font-size:13px;color:var(--text-3)">No inventory linked to this distributor</div>`}
      </div>

      <div class="profile-footer">
        ${lowStock.length && d.email ? `
          <button class="btn btn-pri" onclick="sendLowStockEmail(${d.id},'${d.name.replace(/'/g,"\\'")}','${d.email}',${JSON.stringify(lowStock.map(i => ({ name: i.product_name })))})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:5px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
            Send Email Reminder
          </button>` : `<span></span>`}
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="closeDistProfile();openDistributorModal('${d.id}')">Edit</button>
          <button class="btn btn-ghost" onclick="closeDistProfile()">Close</button>
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div style="padding:48px;text-align:center;color:var(--red);font-size:13px">${esc(e.message)}</div>`;
  }
}

function closeDistProfile() {
  document.getElementById('distProfileModal')?.classList.remove('active');
}

/* ══════════════════════════════════════════
   RETAILER PROFILE
══════════════════════════════════════════ */
async function openRetailerProfile(id) {
  const modal = document.getElementById('retProfileModal');
  const content = document.getElementById('retProfileContent');
  if (!modal || !content) return;
  content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3);font-size:13px">Loading profile…</div>';
  modal.classList.add('active');
  try {
    const r = await apiFetch(`/retailers/${id}`);
    const statusBadge = r.status === 'active' ? 'badge-green' : 'badge-gray';

    content.innerHTML = `
      <div class="profile-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:5px">${esc(r.name)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:rgba(255,255,255,.75)">
              ${r.owner_name ? `<span>👤 ${esc(r.owner_name)}</span>` : ''}
              ${r.phone ? `<span>📞 ${esc(r.phone)}</span>` : ''}
              ${r.email ? `<span>✉ ${esc(r.email)}</span>` : ''}
              <span>📍 ${esc(r.city || '—')}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span class="badge badge-blue">${esc(r.type || '—')}</span>
            <span class="badge ${statusBadge}">${r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—'}</span>
            <button class="profile-close-btn" onclick="closeRetProfile()">×</button>
          </div>
        </div>
      </div>

      <div class="profile-stats-row">
        <div class="profile-stat">
          <div class="profile-stat-val">${r.monthly_orders ?? '—'}</div>
          <div class="profile-stat-label">Monthly Orders</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val" style="font-size:14px">${esc(r.last_order || '—')}</div>
          <div class="profile-stat-label">Last Order</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val" style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.distributor || '—')}</div>
          <div class="profile-stat-label">Distributor</div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Contact & Business</div>
        <div class="profile-grid">
          <div>
            <div class="profile-field-label">Owner Name</div>
            <div class="profile-field-val">${esc(r.owner_name || '—')}</div>
          </div>
          <div>
            <div class="profile-field-label">Store Type</div>
            <div class="profile-field-val">${esc(r.type || '—')}</div>
          </div>
          <div>
            <div class="profile-field-label">Phone</div>
            <div class="profile-field-val">${esc(r.phone || '—')}</div>
          </div>
          <div>
            <div class="profile-field-label">Email</div>
            <div class="profile-field-val">${esc(r.email || '—')}</div>
          </div>
          <div style="grid-column:1/-1">
            <div class="profile-field-label">GSTIN</div>
            <div class="profile-field-val" style="font-family:var(--ff-font-mono, ui-monospace, Menlo, monospace);font-size:12px">${esc(r.gstin || '—')}</div>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Address</div>
        <div style="font-size:13px;color:var(--text);line-height:1.7">
          ${r.address ? `${esc(r.address)}<br>${r.city ? esc(r.city.split(',')[0]) : ''} — ${esc(r.pincode) || ''}` : '<span style="color:var(--text-3)">No address on file</span>'}
        </div>
      </div>

      <div class="profile-footer">
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="closeRetProfile();openRetailerModal(${r.id})">Edit</button>
          <button class="btn btn-ghost" onclick="closeRetProfile()">Close</button>
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div style="padding:48px;text-align:center;color:var(--red);font-size:13px">${esc(e.message)}</div>`;
  }
}

function closeRetProfile() {
  document.getElementById('retProfileModal')?.classList.remove('active');
}

/* ══════════════════════════════════════════
   DEALER DOCUMENTS
   Read-only review of the registration documents each dealer uploaded to
   Cloudinary. View opens the secure_url in a new tab; Download uses the
   fl_attachment variant the API returns. Missing docs disable both buttons.
══════════════════════════════════════════ */
let allDealerDocs = [];

// Inline SVG icons for the Dealer Documents UI (no icon-font dependency).
const SA_ICON_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M20 6 9 17l-5-5"/></svg>';
const SA_ICON_X     = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const SA_ICON_FIRM  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h.01M9 12h.01M9 15h.01"/></svg>';
const SA_ICON_PHONE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const SA_ICON_MAIL  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';

async function loadDealerDocs() {
  const tbody = document.getElementById('doc-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">Loading dealers…</td></tr>`;
  try {
    allDealerDocs = await apiFetch('/dealer-documents');
    renderDealerDocs(allDealerDocs);
    const complete = allDealerDocs.filter(d => d.docStatus === 'complete').length;
    const sub = document.getElementById('doc-sub');
    if (sub) sub.textContent = `${allDealerDocs.length} registered dealer${allDealerDocs.length === 1 ? '' : 's'} · ${complete} with all documents uploaded`;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red,#B03332);padding:24px">Could not load dealers: ${esc(e.message)}</td></tr>`;
  }
}

function docStatusBadge(d) {
  if (d.docStatus === 'complete') return `<span class="badge badge-green">${d.uploaded}/${d.total} Uploaded</span>`;
  if (d.docStatus === 'none')     return `<span class="badge badge-red">Not Uploaded</span>`;
  return `<span class="badge badge-amber">${d.uploaded}/${d.total} Uploaded</span>`;
}

function renderDealerDocs(data) {
  const tbody = document.getElementById('doc-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">No registered dealers found</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  data.forEach(d => {
    const sc = d.status === 'active' ? 'badge-green' : d.status === 'pending' ? 'badge-amber' : 'badge-gray';
    const statusLabel = d.status ? d.status.charAt(0).toUpperCase() + d.status.slice(1) : '—';
    tbody.innerHTML += `<tr>
      <td><strong style="color:var(--pri);cursor:pointer;text-decoration:underline;text-underline-offset:3px" onclick="openDealerDocs('${d.id}')">${esc(d.name || '—')}</strong></td>
      <td style="font-size:12px">${esc(d.firmName || '—')}</td>
      <td style="font-size:12px">${esc(d.email || '—')}</td>
      <td style="font-size:12px">${esc(d.phone || '—')}</td>
      <td><span class="badge ${sc}">${esc(statusLabel)}</span></td>
      <td>${docStatusBadge(d)}</td>
      <td class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="openDealerDocs('${d.id}')">View Documents</button></td>
    </tr>`;
  });
}

function filterDealerDocs() {
  const search = (document.getElementById('doc-search')?.value || '').toLowerCase();
  const status = document.getElementById('doc-status-filter')?.value || '';
  renderDealerDocs(allDealerDocs.filter(d =>
    (!search ||
      (d.name || '').toLowerCase().includes(search) ||
      (d.firmName || '').toLowerCase().includes(search) ||
      (d.email || '').toLowerCase().includes(search)) &&
    (!status || d.docStatus === status)
  ));
}

// View: open the Cloudinary secure_url in a new tab (PDFs render, images at full res).
function viewDealerDoc(url) {
  if (!url) { toast('Document is not available', 'error'); return; }
  window.open(url, '_blank', 'noopener');
}

// Download: fl_attachment URL forces the browser to download the original file.
function downloadDealerDoc(url, fileName) {
  if (!url) { toast('Document is not available', 'error'); return; }
  const a = document.createElement('a');
  a.href = url;
  if (fileName) a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function docCardHtml(doc) {
  const okIcon = doc.uploaded
    ? `<span style="color:#0A7C4E;font-weight:600;display:inline-flex;align-items:center;gap:4px">${SA_ICON_CHECK} Uploaded</span>`
    : `<span style="color:#B03332;font-weight:600;display:inline-flex;align-items:center;gap:4px">${SA_ICON_X} Not Uploaded</span>`;
  const meta = doc.uploaded
    ? `<div class="doc-card-meta">${esc(doc.fileName || 'file')}${doc.uploadedAt ? ' · ' + esc(doc.uploadedAt) : ''}</div>`
    : `<div class="doc-card-meta">No document uploaded</div>`;
  const buttons = doc.uploaded
    ? `<button class="btn btn-ghost btn-sm" onclick="viewDealerDoc('${encodeURI(doc.url)}')">View</button>
       <button class="btn btn-pri btn-sm" onclick="downloadDealerDoc('${encodeURI(doc.downloadUrl || doc.url)}','${esc(doc.fileName || '')}')">Download</button>`
    : `<button class="btn btn-ghost btn-sm" disabled style="opacity:.5;cursor:not-allowed">View</button>
       <button class="btn btn-ghost btn-sm" disabled style="opacity:.5;cursor:not-allowed">Download</button>`;
  return `<div class="doc-card">
    <div class="doc-card-head">
      <div class="doc-card-title">${esc(doc.label)}</div>
      ${okIcon}
    </div>
    ${meta}
    <div class="doc-card-actions">${buttons}</div>
  </div>`;
}

async function openDealerDocs(id) {
  const modal = document.getElementById('docModal');
  const content = document.getElementById('docModalContent');
  if (!modal || !content) return;
  content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3);font-size:13px">Loading documents…</div>';
  modal.classList.add('active');
  try {
    const r = await apiFetch(`/dealer-documents/${id}`);
    const sc = r.status === 'active' ? 'badge-green' : r.status === 'pending' ? 'badge-amber' : 'badge-gray';
    const statusLabel = r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—';
    content.innerHTML = `
      <div class="profile-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:5px">${esc(r.name || '—')}</div>
            <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:rgba(255,255,255,.75)">
              ${r.firmName ? `<span style="display:inline-flex;align-items:center;gap:5px">${SA_ICON_FIRM} ${esc(r.firmName)}</span>` : ''}
              ${r.phone ? `<span style="display:inline-flex;align-items:center;gap:5px">${SA_ICON_PHONE} ${esc(r.phone)}</span>` : ''}
              ${r.email ? `<span style="display:inline-flex;align-items:center;gap:5px">${SA_ICON_MAIL} ${esc(r.email)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span class="badge ${sc}">${esc(statusLabel)}</span>
            <button class="profile-close-btn" onclick="closeDealerDocs()">×</button>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Dealer Information</div>
        <div class="profile-grid">
          <div><div class="profile-field-label">Firm Name</div><div class="profile-field-val">${esc(r.firmName || '—')}</div></div>
          <div><div class="profile-field-label">Email</div><div class="profile-field-val">${esc(r.email || '—')}</div></div>
          <div><div class="profile-field-label">Mobile</div><div class="profile-field-val">${esc(r.phone || '—')}</div></div>
          <div><div class="profile-field-label">Registration Date</div><div class="profile-field-val">${esc(r.registeredAt || '—')}</div></div>
          <div><div class="profile-field-label">Dealer Status</div><div class="profile-field-val">${esc(statusLabel)}</div></div>
          <div><div class="profile-field-label">GSTIN</div><div class="profile-field-val" style="font-family:var(--ff-font-mono, ui-monospace, Menlo, monospace);font-size:12px">${esc(r.gstNumber || '—')}</div></div>
          <div style="grid-column:1/-1"><div class="profile-field-label">Address</div><div class="profile-field-val">${esc(r.address || '—')}</div></div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Uploaded Documents</div>
        <div class="doc-grid">
          ${(r.documents || []).map(docCardHtml).join('')}
        </div>
      </div>

      <div class="profile-footer">
        <span></span>
        <button class="btn btn-ghost" onclick="closeDealerDocs()">Close</button>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div style="padding:48px;text-align:center;color:var(--red,#B03332)">
      Could not load documents: ${esc(e.message)}
      <div style="margin-top:16px"><button class="btn btn-ghost" onclick="closeDealerDocs()">Close</button></div>
    </div>`;
  }
}

function closeDealerDocs() {
  document.getElementById('docModal')?.classList.remove('active');
}

/* ══════════════════════════════════════════
   LOW STOCK EMAIL
══════════════════════════════════════════ */
async function sendLowStockEmail(id, name, email, items) {
  try {
    await apiFetch('/notify/low-stock', {
      method: 'POST',
      body: JSON.stringify({ distributor_id: id, distributor_name: name, email, items }),
    });
    toast(`Email reminder sent to ${name}`, 'success');
  } catch (e) { toast('Failed to send email: ' + e.message, 'error'); }
}

/* ══════════════════════════════════════════
   LOGIN REQUEST NOTIFICATIONS (polling)
══════════════════════════════════════════ */
let _lastPendingCount = -1;
let _loginNotifTimer = null;

async function pollNewLogins() {
  try {
    const data = await apiFetch('/approvals?status=pending');
    const count = data.length;
    if (_lastPendingCount !== -1 && count > _lastPendingCount) {
      const newCount = count - _lastPendingCount;
      const latest = data[data.length - 1];
      showLoginNotification(newCount, latest);
    }
    // Always rehydrate the visible UI so the Approvals table reflects backend
    // state without the user clicking refresh — regardless of count delta. This
    // also picks up rows whose status changed (approved/rejected elsewhere).
    if (_lastPendingCount === -1 || count !== _lastPendingCount) {
      allApprovals = [];
      loadDashboardStats();
      loadPendingWidget();
      loadApprovalsTable();
    }
    _lastPendingCount = count;
  } catch (_) {}
}

function showLoginNotification(count, latest) {
  const notif = document.getElementById('login-notif');
  const msg = document.getElementById('login-notif-msg');
  if (!notif || !msg) return;
  if (count === 1 && latest) {
    msg.textContent = `${latest.name || 'A user'} (${latest.type || 'user'}) is requesting access`;
  } else {
    msg.textContent = `${count} new users are requesting access`;
  }
  notif.classList.add('show');
  clearTimeout(_loginNotifTimer);
  _loginNotifTimer = setTimeout(dismissLoginNotif, 8000);
}

function dismissLoginNotif() {
  document.getElementById('login-notif')?.classList.remove('show');
}

function reviewLoginRequest() {
  dismissLoginNotif();
  showPage('approvals');
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  renderStatePerf();
  loadSettings();
  await Promise.allSettled([
    loadDashboardStats(),
    loadPendingWidget(),
    loadApprovalsTable(),
    loadDistributors(),
    loadRetailers(),
    loadDealerDocs(),
    loadProducts(),
    loadInventory(),
    loadWallet(),
    loadSchemes(),
    loadDistMapping(),
    loadPricingTable(),
    loadProductPricing(),
  ]);
  // Poll for new pending KYC approvals every 10s so the admin sees newly-signed-up
  // retailers and order requests without manually refreshing the page.
  setTimeout(pollNewLogins, 3000);
  setInterval(pollNewLogins, 10000);
});

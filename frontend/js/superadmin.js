const API_BASE = '/api/superadmin';

const pages = ['dashboard','approvals','distributors','retailers','products','pricing','wallet','schemes','inventory','analytics','reports','dist-mapping','settings'];

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
const states = [
  { name: 'Maharashtra', gmv: '₹38.2L', pct: 75.8 },
  { name: 'Karnataka',   gmv: '₹29.5L', pct: 62.4 },
  { name: 'Delhi',       gmv: '₹22.1L', pct: 52.0 },
  { name: 'Tamil Nadu',  gmv: '₹18.7L', pct: 42.5 },
  { name: 'Gujarat',     gmv: '₹15.3L', pct: 32.0 },
];

function renderStatePerf() {
  [document.getElementById('state-perf'), document.getElementById('analytics-states')].forEach(el => {
    if (!el) return;
    el.innerHTML = '';
    states.forEach(s => {
      el.innerHTML += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:110px;font-size:13px;font-weight:500">${s.name}</div>
        <div style="flex:1"><div class="prog-wrap"><div class="prog-bar" style="width:${s.pct}%"></div></div></div>
        <div style="font-size:13px;font-weight:500;width:52px;text-align:right">${s.pct}%</div>
        <div style="font-size:12px;color:var(--text-2);width:60px;text-align:right">${s.gmv}</div>
      </div>`;
    });
  });
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
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;color:var(--text-3);padding:24px">No products found</td></tr>`;
    return;
  }
  // Build thumbnail <td>: real image if uploaded, otherwise an initial-letter
  // placeholder so the column never collapses to whitespace.
  function thumbCell(d) {
    if (d.imageUrl) {
      return `<td><img src="${esc(d.imageUrl)}" alt="" class="prod-thumb" loading="lazy"></td>`;
    }
    const initial = String(d.name || '?').trim().charAt(0).toUpperCase() || '?';
    return `<td><span class="prod-thumb prod-thumb--fallback">${esc(initial)}</span></td>`;
  }
  // data-label is what the responsive "card" view shows next to each cell
  // when the table collapses to a stacked layout on narrow screens.
  tbody.innerHTML = '';
  data.forEach(d => {
    tbody.innerHTML += `<tr>
      ${thumbCell(d)}
      <td data-label="Name"><strong>${esc(d.name)}</strong></td>
      <td data-label="SKU" style="font-family:'DM Mono',monospace;font-size:12px">${esc(d.sku)}</td>
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
    (!search || d.name.toLowerCase().includes(search) || d.sku.toLowerCase().includes(search)) &&
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
  resetProductImagePreview();
  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.remove('active');
}

/* ── Product image preview helpers ── */
function setProductImagePreview(src) {
  const box = document.getElementById('prodImagePreview');
  if (!box) return;
  box.innerHTML = src
    ? `<img src="${src}" alt="Product image preview">`
    : '<span class="prod-image-placeholder">No image selected</span>';
  const clearBtn = document.getElementById('productImageClear');
  if (clearBtn) clearBtn.style.display = src ? '' : 'none';
}

function resetProductImagePreview() {
  setProductImagePreview('');
  const input = document.getElementById('productImageInput');
  if (input) input.value = '';
}

document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'productImageInput') {
    const file = e.target.files && e.target.files[0];
    if (!file) { setProductImagePreview(''); return; }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image is larger than 5 MB', 'error');
      e.target.value = '';
      setProductImagePreview('');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) { setProductImagePreview(ev.target.result); };
    reader.readAsDataURL(file);
  }
});

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'productImageClear') {
    resetProductImagePreview();
  }
});

async function editProduct(id) {
  try {
    const product = await apiFetch(`/products/${id}`);
    const form = document.getElementById('productForm');
    form.querySelector('[name=product-name]').value     = product.name || '';
    form.querySelector('[name=product-sku]').value      = product.sku || '';
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
    // Clear any selected file, then show the existing image (if any) as the
    // preview. Picking a new file in the input replaces it; leaving the input
    // empty keeps the existing image untouched server-side.
    var fileInput = document.getElementById('productImageInput');
    if (fileInput) fileInput.value = '';
    setProductImagePreview(product.imageUrl || '');
    document.getElementById('productModal').classList.add('active');
  } catch (e) { toast('Failed to load product', 'error'); }
}

async function saveProduct() {
  const form = document.getElementById('productForm');
  const productId = document.getElementById('productId').value;
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
  const payload = {
    name:             form.querySelector('[name=product-name]').value.trim(),
    sku:              form.querySelector('[name=product-sku]').value.trim(),
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

  // Use multipart only when a file is attached; otherwise JSON is fine.
  // Multer leaves req.body alone for JSON requests, so the backend handles both.
  const fileInput = document.getElementById('productImageInput');
  const file = fileInput && fileInput.files && fileInput.files[0];
  const url = productId ? `/products/${productId}` : '/products';
  const method = productId ? 'PUT' : 'POST';

  const submitBtn = document.getElementById('submitBtn');
  const origBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = productId ? 'Updating…' : 'Adding…';

  try {
    if (file) {
      const fd = new FormData();
      Object.keys(payload).forEach(k => {
        if (payload[k] !== null && payload[k] !== undefined) fd.append(k, payload[k]);
      });
      fd.append('image', file);
      // apiFetch sets Content-Type: application/json by default — pass FormData
      // directly via fetch so the browser sets the multipart boundary itself.
      const token = localStorage.getItem('ff_token');
      const res = await fetch(API_BASE + url, {
        method,
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd,
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('ff_token');
        localStorage.removeItem('ff_user');
        window.location.replace('/admin.html');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || ('HTTP ' + res.status));
      }
    } else {
      await apiFetch(url, { method, body: JSON.stringify(payload) });
    }
    toast(productId ? 'Product updated successfully' : 'Product added successfully');
    closeProductModal();
    allProducts = [];
    await loadProducts();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origBtnText;
  }
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
        <td style="font-family:'DM Mono',monospace;font-size:12px">${esc(d.invoice_no)}</td>
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-3);padding:24px">No inventory found</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  data.forEach(d => {
    const sc = d.status === 'ok' ? 'badge-green' : d.status === 'low' ? 'badge-amber' : 'badge-red';
    tbody.innerHTML += `<tr>
      <td><strong>${esc(d.product_name)}</strong></td>
      <td style="font-family:'DM Mono',monospace;font-size:12px">${esc(d.sku)}</td>
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
    d.sku.toLowerCase().includes(search) ||
    d.category.toLowerCase().includes(search)
  ));
}

function exportInventoryCSV() {
  if (!allInventory.length) { toast('No inventory data to export', 'error'); return; }
  const rows = [
    ['Product Name','SKU','Category','Total Stock','Reserved','Available','Reorder Level','Status'],
    ...allInventory.map(d => [d.product_name,d.sku,d.category,d.total_stock,d.reserved,d.available,d.reorder_level,d.status]),
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
function exportReport(type) {
  const config = {
    gmv: {
      rows: [
        ['Month','GMV (₹L)','Target (₹L)'],
        ['Dec 2025','85','90'],['Jan 2026','92','90'],['Feb 2026','78','90'],
        ['Mar 2026','104','110'],['Apr 2026','122','110'],['May 2026','156','150'],
      ],
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
    settlement: {
      rows: [['Distributor','Invoice','Amount','Due Date','Status']],
      file: 'settlement-report.csv',
      label: 'Settlement report',
    },
    inventory: {
      rows: () => {
        const rows = [['Product','SKU','Category','Total Stock','Reserved','Available','Reorder Level','Status']];
        allInventory.forEach(d => rows.push([d.product_name,d.sku,d.category,d.total_stock,d.reserved,d.available,d.reorder_level,d.status]));
        return rows;
      },
      file: 'inventory-report.csv',
      label: 'Inventory report',
    },
    schemes: {
      rows: () => {
        const rows = [['Scheme','Type','Category','Channel','Status','Redemptions','Target','Start','End']];
        return rows;
      },
      file: 'scheme-performance.csv',
      label: 'Scheme performance report',
    },
    states: {
      rows: [
        ['State','GMV','Performance %'],
        ...states.map(s => [s.name, s.gmv, s.pct + '%']),
      ],
      file: 'state-report.csv',
      label: 'State-wise report',
    },
  };

  const exp = config[type];
  if (!exp) return;
  const rows = typeof exp.rows === 'function' ? exp.rows() : exp.rows;
  downloadCSV(rows, exp.file);
  toast(`${exp.label} downloaded`);
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
  localStorage.setItem('fairford_settings', JSON.stringify(settings));
  toast('Settings saved successfully');
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
window.addEventListener('load', () => {
  const gmvCtx = document.getElementById('gmvChart');
  if (gmvCtx) {
    new Chart(gmvCtx, {
      type: 'bar',
      data: {
        labels: ['Dec','Jan','Feb','Mar','Apr','May'],
        datasets: [{ label: 'GMV (₹L)', data: [85,92,78,104,122,156], backgroundColor: '#5B3EE8', borderRadius: 6, borderSkipped: false }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#A09BBF', font: { size: 11 } } },
          y: { grid: { color: '#F0EFF8' }, ticks: { color: '#A09BBF', font: { size: 11 }, callback: v => v + 'L' } },
        },
      },
    });
  }

  const wdCtx = document.getElementById('walletDonut');
  if (wdCtx) {
    new Chart(wdCtx, {
      type: 'doughnut',
      data: {
        labels: ['Settled','Escrow','Pending'],
        datasets: [{ data: [74,16,10], backgroundColor: ['#0FA86A','#5B3EE8','#E24B4A'], borderWidth: 0, hoverOffset: 4 }],
      },
      options: { cutout: '72%', plugins: { legend: { display: false } }, maintainAspectRatio: false },
    });
  }

  const revCtx = document.getElementById('revChart');
  if (revCtx) {
    new Chart(revCtx, {
      type: 'line',
      data: {
        labels: ['Dec','Jan','Feb','Mar','Apr','May'],
        datasets: [
          { label: 'Revenue', data: [85,92,78,104,122,156], borderColor: '#5B3EE8', backgroundColor: 'rgba(91,62,232,.08)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#5B3EE8' },
          { label: 'Target', data: [90,90,90,110,110,150], borderColor: '#0FA86A', borderDash: [4,3], fill: false, tension: .4, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#A09BBF', font: { size: 11 } } },
          y: { grid: { color: '#F0EFF8' }, ticks: { color: '#A09BBF', font: { size: 11 }, callback: v => v + 'L' } },
        },
      },
    });
  }

  const catCtx = document.getElementById('catDonut');
  if (catCtx) {
    new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: ['Antibiotics','Cardiac','Vitamins','Analgesics','Others'],
        datasets: [{ data: [34,22,18,14,12], backgroundColor: ['#5B3EE8','#0FA86A','#D97B0A','#E24B4A','#A09BBF'], borderWidth: 0 }],
      },
      options: { cutout: '68%', plugins: { legend: { display: false } }, maintainAspectRatio: false },
    });
  }
});

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
        <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">${esc(i.sku)}</td>
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
            <div class="profile-field-val" style="font-family:'DM Mono',monospace;font-size:12px">${d.gstin || '—'}</div>
          </div>
          <div>
            <div class="profile-field-label">Drug License No.</div>
            <div class="profile-field-val" style="font-family:'DM Mono',monospace;font-size:12px">${d.license_no || '—'}</div>
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
              <thead><tr><th>Product</th><th>SKU</th><th style="text-align:center">Total</th><th style="text-align:center">Available</th><th style="text-align:center">Reorder</th><th>Status</th></tr></thead>
              <tbody>${invRows}</tbody>
            </table>
          </div>` : `<div style="font-size:13px;color:var(--text-3)">No inventory linked to this distributor</div>`}
      </div>

      <div class="profile-footer">
        ${lowStock.length && d.email ? `
          <button class="btn btn-pri" onclick="sendLowStockEmail(${d.id},'${d.name.replace(/'/g,"\\'")}','${d.email}',${JSON.stringify(lowStock.map(i => ({ sku: i.sku, name: i.product_name })))})">
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
            <div class="profile-field-val" style="font-family:'DM Mono',monospace;font-size:12px">${esc(r.gstin || '—')}</div>
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
    loadProducts(),
    loadInventory(),
    loadWallet(),
    loadSchemes(),
    loadDistMapping(),
    loadPricingTable(),
  ]);
  // Poll for new pending KYC approvals every 10s so the admin sees newly-signed-up
  // retailers and order requests without manually refreshing the page.
  setTimeout(pollNewLogins, 3000);
  setInterval(pollNewLogins, 10000);
});

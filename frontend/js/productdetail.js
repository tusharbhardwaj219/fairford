/* =====================================================================
   productdetail.js — B2B Pharma Marketplace
   Auth-guarded product detail page.
   Checks JWT → redirects to login if missing → fetches from real API
   → renders role-based pricing (never exposes the other role's price).
   ===================================================================== */

const API_BASE = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', function () {

  // ── 1. Auth guard ────────────────────────────────────────────────────────

  const params    = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  const token   = localStorage.getItem('ff_token');
  const userRaw = localStorage.getItem('ff_user');

  if (!token || !userRaw) {
    // Store intended destination so login can redirect back
    if (productId) {
      localStorage.setItem('ff_redirect_product', productId);
    }
    window.location.href = 'login&signup.html';
    return;
  }

  let currentUser;
  try {
    currentUser = JSON.parse(userRaw);
  } catch (_) {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    window.location.href = 'login&signup.html';
    return;
  }

  if (!productId) {
    showError('No product ID specified. <a href="product.html">Browse products</a>');
    return;
  }

  // ── 2. Render header / footer if helpers exist ───────────────────────────

  if (typeof renderHeader === 'function') {
    document.getElementById('site-header').innerHTML = renderHeader('products');
    if (typeof initHeader === 'function') initHeader();
  }
  if (typeof renderFooter === 'function') {
    document.getElementById('site-footer').innerHTML = renderFooter();
    if (typeof initFooter === 'function') initFooter();
  }

  showSkeleton();

  // ── 3. Fetch product: use API for MongoDB ObjectIDs, static data for demo IDs ─

  const isMongoId = /^[0-9a-fA-F]{24}$/.test(productId);

  if (!isMongoId) {
    // Non-MongoDB ID (e.g. "med-001") — serve from static data.js catalogue
    if (typeof getProductById !== 'function') {
      showError('Product data unavailable. Please try again.');
      return;
    }
    const sp = getProductById(productId);
    if (!sp) {
      showError('Product not found. <a href="product.html">Browse all products</a>');
      return;
    }
    const role      = (currentUser && currentUser.role) || 'ret';
    const userPrice = role === 'dist'
      ? (sp.distributorPrice || sp.retailerPrice || 0)
      : (sp.retailerPrice || 0);
    // Retailers must never see MRP
    const mrp      = role === 'ret' ? 0 : (sp.mrp || 0);
    const discount = mrp > 0 ? Math.round(((mrp - userPrice) / mrp) * 100) : 0;

    render({
      _id:          sp.id,
      productId:    sp.id,
      name:         sp.name,
      manufacturer: sp.brand,
      brand:        sp.brand,
      category:     sp.category,
      dosageForm:   sp.dosageForm  || null,
      strength:     sp.strength    || null,
      packSize:     sp.packSize    || null,
      mrp,
      userPrice,
      discount,
      gst:          sp.gst         || null,
      stock:        sp.stock       || 0,
      minOrderQty:  sp.moq         || 1,
      composition:  sp.composition || [],
      uses:         sp.uses        || null,
      description:  sp.uses        || null,
      ratings:      sp.rating      || null,
      expiryDate:   sp.expDate     || null,
      images:       [],
      schedule:     null,
      batchNo:      null,
      hsn:          null
    }, currentUser);
    return;
  }

  // MongoDB ObjectID path — fetch from real API
  fetch(`${API_BASE}/products/${productId}`, {
    method:  'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json'
    }
  })
  .then(function (res) {
    if (res.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('ff_token');
      localStorage.removeItem('ff_user');
      localStorage.setItem('ff_redirect_product', productId);
      showSessionExpired();
      return null;
    }
    if (res.status === 403) {
      showUnauthorized();
      return null;
    }
    return res.json();
  })
  .then(function (json) {
    if (!json) return;
    if (!json.success) {
      showError(json.message || 'Unable to fetch product details. Please try again.');
      return;
    }
    render(json.product, currentUser);
  })
  .catch(function () {
    showError('Unable to fetch product details.<br>Please try again.');
  });

  // ── 4. Render ─────────────────────────────────────────────────────────────

  function render(p, user) {
    hideSkeleton();

    const role      = (user && user.role) || 'ret';
    const IS_DIST   = role === 'dist';
    const IS_RET    = role === 'ret';

    // Resolve price from the field the backend returned for this role
    const userPrice = IS_DIST
      ? (p.distributorPrice || p.userPrice || p.netPrice || 0)
      : (p.retailerPrice    || p.userPrice || p.netPrice || 0);

    // Retailers must never see MRP
    const mrp     = IS_RET ? 0 : (p.mrp || 0);
    const discount = (p.discount != null && !IS_RET)
      ? p.discount
      : (mrp > 0 ? Math.round(((mrp - userPrice) / mrp) * 100) : 0);

    const stock   = p.stock || 0;
    const inStock = stock > 0;
    const moq     = p.minOrderQty || 1;

    document.title = 'Fair Ford — ' + (p.name || 'Product');

    const root = document.getElementById('detail-root');
    root.innerHTML = `
      ${breadcrumb(p)}

      <section class="hero">
        <div class="gallery">
          <div class="main-img" id="main-img" style="display:flex;align-items:center;justify-content:center;background:#f0f9ff;border-radius:18px;min-height:320px;cursor:zoom-in;">
            ${p.images && p.images[0]
              ? `<img src="${p.images[0]}" alt="${esc(p.name)}" style="max-width:100%;max-height:320px;object-fit:contain;border-radius:14px;"/>`
              : productPlaceholder(p.category)}
          </div>
        </div>

        <div class="hero-info">
          <span class="brandtag">${esc(p.manufacturer || p.brand || 'Pharma')}</span>
          <h1>${esc(p.name)}</h1>
          <div class="hero-meta">
            <span class="hero-cat">${esc(p.category || '')}${p.dosageForm ? ' · ' + esc(p.dosageForm) : ''}</span>
            <span class="badge ${inStock ? 'badge-green' : 'badge-red'}">${inStock ? 'In Stock' : 'Out of Stock'}</span>
            ${p.ratings ? `<span>★ ${Number(p.ratings).toFixed(1)}</span>` : ''}
          </div>

          <div class="pricing-card">
            <div class="pricing-grid">
              <div class="pcell">
                <div class="lab">${IS_DIST ? 'Distributor Price' : 'Retailer Price'}</div>
                <div class="val big" style="color:var(--teal-700,#0d9488)">₹${userPrice.toLocaleString('en-IN')}</div>
              </div>
              ${!IS_RET ? `
              <div class="pcell">
                <div class="lab">MRP</div>
                <div class="val strike">₹${mrp.toLocaleString('en-IN')}</div>
              </div>
              <div class="pcell">
                <div class="lab">Discount</div>
                <div class="val" style="color:#16a34a;font-weight:700">${discount}% off</div>
              </div>` : ''}
              ${IS_DIST && p.margin != null ? `
              <div class="pcell">
                <div class="lab">Margin</div>
                <div class="val" style="color:#16a34a;font-weight:700">${p.margin}%</div>
              </div>` : ''}
              <div class="pcell">
                <div class="lab">Stock</div>
                <div class="val">${inStock ? stock.toLocaleString('en-IN') + ' units' : 'Out of Stock'}</div>
              </div>
              <div class="pcell">
                <div class="lab">Min. Order</div>
                <div class="val">${moq} unit${moq > 1 ? 's' : ''}</div>
              </div>
              ${p.expiryDate ? `<div class="pcell"><div class="lab">Expiry</div><div class="val">${fmtDate(p.expiryDate)}</div></div>` : ''}
              ${p.packSize   ? `<div class="pcell"><div class="lab">Pack Size</div><div class="val">${esc(p.packSize)}</div></div>` : ''}
            </div>
          </div>
        </div>
      </section>

      <div class="detail-grid">
        <div class="detail-main">
          ${descBlock(p)}
          ${compositionBlock(p)}
          ${specBlock(p)}
        </div>

        <aside class="sticky-rail">
          ${purchaseBlock(p, inStock, moq, userPrice, mrp)}
        </aside>
      </div>
    `;

    root.hidden = false;
    wireEvents(p, inStock, moq);
    if (typeof store !== 'undefined' && store.syncCounts) store.syncCounts();
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  function breadcrumb(p) {
    return `<nav class="breadcrumb" aria-label="Breadcrumb" style="margin:18px 0 4px">
      <a href="index.html">Home</a><span class="sep">/</span>
      <a href="product.html">Products</a><span class="sep">/</span>
      ${p.category ? `<a href="product.html">${esc(p.category)}</a><span class="sep">/</span>` : ''}
      <span class="current">${esc(p.name || 'Product')}</span>
    </nav>`;
  }

  function descBlock(p) {
    if (!p.description && !p.uses) return '';
    return `<div class="block">
      <h2>Product Description</h2>
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      ${p.uses        ? `<h4>Uses</h4><p>${esc(p.uses)}</p>` : ''}
    </div>`;
  }

  function compositionBlock(p) {
    if (!p.composition) return '';
    const items = Array.isArray(p.composition) ? p.composition : [p.composition];
    if (!items.length) return '';
    return `<div class="block">
      <h2>Composition</h2>
      <ul class="comp-list">
        ${items.map((c, i) => `<li><span class="num">${i + 1}</span>${esc(String(c))}</li>`).join('')}
      </ul>
    </div>`;
  }

  function specBlock(p) {
    const rows = [
      ['Category',      p.category],
      ['Manufacturer',  p.manufacturer || p.brand],
      ['Pack Size',     p.packSize],
      ['Strength',      p.strength],
      ['Dosage Form',   p.dosageForm],
      ['Schedule',      p.schedule],
      ['Batch No.',     p.batchNo],
      ['HSN Code',      p.hsn],
      ['GST',           p.gst != null ? p.gst + '%' : null],
      ['Expiry Date',   p.expiryDate ? fmtDate(p.expiryDate) : null]
    ].filter(r => r[1]);

    if (!rows.length) return '';
    return `<div class="block">
      <h2>Specifications</h2>
      <table class="spec-table"><tbody>
        ${rows.map(r => `<tr><th>${r[0]}</th><td>${esc(String(r[1]))}</td></tr>`).join('')}
      </tbody></table>
    </div>`;
  }

  function purchaseBlock(p, inStock, moq, userPrice, mrp) {
    const dis     = mrp > 0 ? Math.round(((mrp - userPrice) / mrp) * 100) : 0;
    const showMrp = mrp > 0; // mrp is already 0 for retailers (set in render())
    return `<div class="purchase" id="purchase">
      <div class="stock-line">
        <span class="badge ${inStock ? 'badge-green' : 'badge-red'}">${inStock ? 'In Stock' : 'Out of Stock'}</span>
        ${inStock ? `<span class="muted" style="font-size:.85rem">${(p.stock).toLocaleString('en-IN')} available</span>` : ''}
      </div>
      <div style="display:flex;align-items:baseline;gap:10px;margin:12px 0">
        <span style="font-size:1.9rem;font-weight:800;color:var(--teal-700,#0d9488)">₹${userPrice.toLocaleString('en-IN')}</span>
        ${showMrp ? `<span class="muted" style="text-decoration:line-through">₹${mrp.toLocaleString('en-IN')}</span>
        <span style="font-size:.8rem;color:#16a34a;font-weight:600">${dis}% off</span>` : ''}
      </div>
      <div class="qty-row">
        <div class="qty">
          <button id="qminus" aria-label="Decrease">−</button>
          <input type="number" id="qty" value="${moq}" min="${moq}" />
          <button id="qplus" aria-label="Increase">+</button>
        </div>
        <span class="moq-note">Min. order: <b>${moq} unit${moq > 1 ? 's' : ''}</b></span>
      </div>
      <div class="cta-grid">
        <button class="btn btn-primary btn-block" id="add-cart"
          ${!inStock ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
          🛒 ${inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
        <div class="two">
          <button class="btn btn-dark" id="buy-now"
            ${!inStock ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
            ⚡ Buy Now
          </button>
          <button class="btn btn-ghost" id="wish-btn">♡ Wishlist</button>
        </div>
      </div>
    </div>`;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  function wireEvents(p, inStock, moq) {
    const qtyInput = document.getElementById('qty');

    document.getElementById('qminus').addEventListener('click', function () {
      const v = parseInt(qtyInput.value) || moq;
      qtyInput.value = Math.max(moq, v - moq);
    });
    document.getElementById('qplus').addEventListener('click', function () {
      const v = parseInt(qtyInput.value) || moq;
      qtyInput.value = v + moq;
    });
    qtyInput.addEventListener('change', function () {
      let v = parseInt(qtyInput.value) || moq;
      if (v < moq) v = moq;
      qtyInput.value = v;
    });

    const addBtn = document.getElementById('add-cart');
    if (addBtn && inStock) {
      addBtn.addEventListener('click', function () {
        if (typeof store !== 'undefined') {
          store.addToCart(p._id || p.productId, parseInt(qtyInput.value));
          store.syncCounts();
        }
        toast(qtyInput.value + ' unit(s) added to cart');
      });
    }

    const buyBtn = document.getElementById('buy-now');
    if (buyBtn && inStock) {
      buyBtn.addEventListener('click', function () {
        if (typeof store !== 'undefined') {
          store.addToCart(p._id || p.productId, parseInt(qtyInput.value));
          store.syncCounts();
        }
        toast('Proceeding to checkout…');
      });
    }

    const wishBtn = document.getElementById('wish-btn');
    if (wishBtn) {
      wishBtn.addEventListener('click', function () {
        if (typeof store !== 'undefined') {
          const on = store.toggleWish(p._id || p.productId);
          store.syncCounts();
          wishBtn.style.color = on ? 'var(--red,#ef4444)' : '';
          toast(on ? 'Added to wishlist' : 'Removed from wishlist');
        }
      });
    }
  }

  // ── State helpers ─────────────────────────────────────────────────────────

  function showSkeleton() {
    const sk = document.getElementById('detail-skeleton');
    if (sk) sk.style.display = '';
    const root = document.getElementById('detail-root');
    if (root) root.hidden = true;
  }

  function hideSkeleton() {
    const sk = document.getElementById('detail-skeleton');
    if (sk) sk.style.display = 'none';
  }

  function showError(msg) {
    hideSkeleton();
    const root = document.getElementById('detail-root');
    if (!root) return;
    root.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
        <h2 style="color:#dc2626;margin-bottom:8px;">Unable to Load Product</h2>
        <p style="color:#64748b;margin-bottom:24px;">${msg}</p>
        <a href="product.html" class="btn btn-primary" style="display:inline-block;padding:12px 28px;">
          Browse Products
        </a>
      </div>`;
    root.hidden = false;
  }

  function showSessionExpired() {
    hideSkeleton();
    const root = document.getElementById('detail-root');
    if (!root) return;
    root.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">🔒</div>
        <h2 style="margin-bottom:8px;">Session Expired</h2>
        <p style="color:#64748b;margin-bottom:24px;">Please login again to continue.</p>
        <a href="login&signup.html" class="btn btn-primary" style="display:inline-block;padding:12px 28px;">
          Login Again
        </a>
      </div>`;
    root.hidden = false;
  }

  function showUnauthorized() {
    hideSkeleton();
    const root = document.getElementById('detail-root');
    if (!root) return;
    root.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">🚫</div>
        <h2 style="margin-bottom:8px;">Unauthorized Access</h2>
        <p style="color:#64748b;margin-bottom:24px;">
          You don't have permission to view this product.
        </p>
        <a href="index.html" class="btn btn-primary" style="display:inline-block;padding:12px 28px;">
          Go Home
        </a>
      </div>`;
    root.hidden = false;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cap(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  function fmtDate(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d)) return String(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function productPlaceholder(category) {
    return `<div style="width:200px;height:200px;background:linear-gradient(135deg,#e0f2fe,#bae6fd);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:3rem;">💊</div>`;
  }

  function toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 22px;border-radius:8px;font-size:.9rem;z-index:9999;pointer-events:none;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }
});

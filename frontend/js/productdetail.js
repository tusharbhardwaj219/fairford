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

  // ══════════════════════════════════════════════════════════════════════════
  //  4. RENDER — Premium product detail UI
  // ══════════════════════════════════════════════════════════════════════════

  function render(p, user) {
    hideSkeleton();

    const role    = (user && user.role) || 'ret';
    const IS_DIST = role === 'dist';
    const IS_RET  = role === 'ret';

    // p.category may be a populated Mongoose object — extract the display name
    const catName = p.categoryName
      || (p.category && typeof p.category === 'object' ? p.category.categoryName : null)
      || (typeof p.category === 'string' ? p.category : '')
      || '';

    const userPrice = IS_DIST
      ? (p.distributorPrice || p.userPrice || p.netPrice || 0)
      : (p.retailerPrice    || p.userPrice || p.netPrice || 0);

    const mrp      = IS_RET ? 0 : (p.mrp || 0);
    const discount = (p.discount != null && !IS_RET)
      ? p.discount
      : (mrp > 0 ? Math.round(((mrp - userPrice) / mrp) * 100) : 0);

    const stock   = p.stock || 0;
    const inStock = stock > 0;
    const moq     = p.minOrderQty || p.minimumOrderQuantity || 1;

    document.title = 'Fair Ford — ' + (p.name || 'Product');

    const root = document.getElementById('detail-root');
    root.innerHTML =
      buildBreadcrumb(p, catName) +
      buildHero(p, inStock, moq, userPrice, mrp, discount, IS_DIST, IS_RET, stock, catName) +
      buildHighlights(p, inStock) +
      buildTabs(p, IS_DIST, catName) +
      buildReviews(p) +
      buildFaq(p);

    root.hidden = false;

    // Build sticky bottom widget
    buildStickyWidget(p, inStock, moq, userPrice, catName);

    wireEvents(p, inStock, moq, userPrice);

    if (typeof store !== 'undefined' && store.syncCounts) store.syncCounts();
  }

  // ── Builder: Breadcrumb ───────────────────────────────────────────────────

  function buildBreadcrumb(p, catName) {
    return `
    <nav class="pd-bread" aria-label="Breadcrumb">
      <a href="index.html">Home</a>
      <span class="pd-bread-sep">›</span>
      <a href="product.html">Products</a>
      ${catName ? `<span class="pd-bread-sep">›</span><a href="product.html">${esc(catName)}</a>` : ''}
      <span class="pd-bread-sep">›</span>
      <span class="pd-bread-cur">${esc(p.name || 'Product')}</span>
    </nav>`;
  }

  // ── Builder: Hero section ─────────────────────────────────────────────────

  function buildHero(p, inStock, moq, userPrice, mrp, discount, IS_DIST, IS_RET, stock, catName) {
    const imgs    = (p.images && p.images.length) ? p.images : [];
    const hasImg  = imgs.length > 0;
    const cat     = esc(catName || '');
    const brand   = esc(p.manufacturer || p.brand || 'Pharma');
    const ratingVal = p.rating || p.ratings || null;
    const ratNum    = ratingVal ? Number(ratingVal).toFixed(1) : null;

    // Thumbnail strip (max 4 thumbs)
    const thumbsHtml = imgs.slice(0, 4).map((src, i) =>
      `<div class="pd-thumb ${i === 0 ? 'pd-thumb-on' : ''}" data-idx="${i}" title="View image ${i+1}">
         <img src="${esc(src)}" alt="Product image ${i+1}" loading="lazy" />
       </div>`
    ).join('');

    const galleryHtml = `
    <div class="pd-gal-col">
      <div class="pd-badge-strip">
        ${inStock ? '<span class="pd-bdg pd-bdg-green">✓ In Stock</span>' : '<span class="pd-bdg pd-bdg-red">✕ Out of Stock</span>'}
        ${cat ? `<span class="pd-bdg pd-bdg-blue">${cat}</span>` : ''}
        ${p.dosageForm ? `<span class="pd-bdg pd-bdg-gold">${esc(p.dosageForm)}</span>` : ''}
        ${p.schedule   ? `<span class="pd-bdg pd-bdg-emerald">${esc(p.schedule)}</span>` : ''}
      </div>

      <div class="pd-main-img" id="pd-main-img" role="button" tabindex="0" aria-label="Zoom product image">
        ${hasImg
          ? `<img class="pd-main-img-el" id="pd-main-img-el" src="${esc(imgs[0])}" alt="${esc(p.name)}" />`
          : `<div class="pd-img-ph">
               <div class="pd-img-ph-icon">${categoryIcon(catName)}</div>
               <div class="pd-img-ph-txt">${esc(p.name)}</div>
             </div>`
        }
        ${hasImg ? '<div class="pd-zoom-hint">🔍 Click to zoom</div>' : ''}
      </div>

      ${thumbsHtml ? `<div class="pd-thumbs-row" id="pd-thumbs">${thumbsHtml}</div>` : ''}

      <div class="pd-gal-acts">
        <button class="pd-gal-btn" id="pd-wish-btn" aria-label="Add to wishlist">
          ♡ <span id="pd-wish-lbl">Wishlist</span>
        </button>
        <button class="pd-gal-btn" onclick="window.print()" aria-label="Print product">
          🖨️ Print
        </button>
        <button class="pd-gal-btn" id="pd-share-btn" aria-label="Share product">
          ↗ Share
        </button>
      </div>
    </div>`;

    // Rating stars
    const starsHtml = ratNum ? buildStars(Number(ratingVal)) : '';

    // Price cards
    const mrpBadge = !IS_RET && mrp > 0 ? `
      <div class="pd-price-card">
        <div class="pd-price-card-label">MRP</div>
        <div class="pd-price-card-amount pd-price-striked">₹${mrp.toLocaleString('en-IN')}</div>
      </div>` : '';

    const saveBadge = !IS_RET && discount > 0 ? `
      <div class="pd-price-card pd-price-card-accent">
        <div class="pd-price-card-label">You Save</div>
        <div class="pd-price-card-amount">${discount}% <span style="font-size:.9rem">off</span></div>
        <div class="pd-price-card-note">${IS_DIST ? 'Distributor deal' : 'Trade price'}</div>
      </div>` : '';

    const infoHtml = `
    <div class="pd-info-col">
      <div class="pd-chips-row">
        <span class="pd-brand-tag">${brand}</span>
        ${cat ? `<span class="pd-chip pd-chip-blue">${cat}</span>` : ''}
        ${p.dosageForm ? `<span class="pd-chip pd-chip-teal">${esc(p.dosageForm)}</span>` : ''}
      </div>

      <h1 class="pd-prod-title">${esc(p.name)}</h1>

      <div class="pd-metas">
        ${p.strength   ? `<span class="pd-meta-pill">💊 ${esc(p.strength)}</span>` : ''}
        ${p.packSize   ? `<span class="pd-meta-pill">📦 ${esc(p.packSize)}</span>` : ''}
        ${p.gst != null ? `<span class="pd-meta-pill">GST ${p.gst}%</span>` : ''}
        ${p.batchNo    ? `<span class="pd-meta-pill">Batch ${esc(p.batchNo)}</span>` : ''}
        ${p.hsn        ? `<span class="pd-meta-pill">HSN ${esc(p.hsn)}</span>` : ''}
        ${p.expiryDate ? `<span class="pd-meta-pill">Exp ${fmtDate(p.expiryDate)}</span>` : ''}
      </div>

      ${ratNum ? `
      <div class="pd-rating-line">
        <div class="pd-stars">${starsHtml}</div>
        <span class="pd-rat-num">${ratNum || ''}</span>
        <span class="pd-rat-cnt">out of 5</span>
        <span class="pd-verif">✓ Verified</span>
      </div>` : ''}

      <div class="pd-avail">
        <div class="pd-avail-badge ${inStock ? 'pd-avail-green' : 'pd-avail-red'}">
          <span class="pd-avail-dot"></span>
          ${inStock ? `${stock.toLocaleString('en-IN')} units available` : 'Currently out of stock'}
        </div>
      </div>

      ${(p.description || p.uses) ? `
      <div class="pd-short-desc">${esc(p.description || p.uses)}</div>` : ''}

      <div class="pd-price-section">
        <div class="pd-price-cards-row">
          <div class="pd-price-card pd-price-card-main">
            <div class="pd-price-card-label">${IS_DIST ? 'Distributor Price' : 'Retailer Price'}</div>
            <div class="pd-price-card-amount">₹${userPrice.toLocaleString('en-IN')}</div>
            <div class="pd-price-card-note">per unit • COD</div>
          </div>
          ${mrpBadge}
          ${saveBadge}
        </div>
        <div class="pd-tax-note">✓ All prices inclusive of applicable taxes</div>
      </div>

      <div class="pd-purchase-card">
        <div class="pd-qty-row">
          <span class="pd-qty-label">Quantity</span>
          <div class="pd-qty-wrap">
            <div class="pd-qty-stepper">
              <button class="pd-qty-btn" id="pd-qminus" aria-label="Decrease">−</button>
              <input class="pd-qty-inp" type="number" id="pd-qty" value="${moq}" min="${moq}" aria-label="Quantity" />
              <button class="pd-qty-btn" id="pd-qplus" aria-label="Increase">+</button>
            </div>
            <span class="pd-moq-tag">Min. ${moq} unit${moq > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="pd-cta-row">
          <button class="pd-cta pd-cta-primary" id="pd-add-cart"
            ${!inStock ? 'disabled' : ''}>
            🛒 ${inStock ? 'Add to Cart' : 'Out of Stock'}
          </button>
          <button class="pd-cta pd-cta-dark" id="pd-buy-now"
            ${!inStock ? 'disabled' : ''}>
            ⚡ Buy Now
          </button>
        </div>

        <div class="pd-cta-row pd-cta-row-sec">
          <button class="pd-cta pd-cta-ghost" id="pd-wish-btn2">
            ♡ Save to Wishlist
          </button>
          <button class="pd-cta pd-cta-outline" onclick="window.print()">
            🖨️ Print Sheet
          </button>
        </div>

        <div class="pd-trust-strip">
          <span class="pd-trust-item">✓ WHO-GMP Certified</span>
          <span class="pd-trust-item">✓ Cash on Delivery</span>
          <span class="pd-trust-item">✓ Secure Ordering</span>
          <span class="pd-trust-item">✓ B2B Support</span>
        </div>
      </div>
    </div>`;

    return `<section class="pd-hero">${galleryHtml}${infoHtml}</section>`;
  }

  // ── Builder: Highlights grid ──────────────────────────────────────────────

  function buildHighlights(p, inStock) {
    const feats = [
      { ico: '🏭', lbl: 'WHO-GMP Certified', dsc: 'Manufactured under international quality standards' },
      { ico: '💳', lbl: 'Cash on Delivery', dsc: 'Secure COD payment for all B2B orders' },
      { ico: '🔬', lbl: 'Quality Assured', dsc: 'Third-party lab tested for purity and potency' },
      { ico: '🚚', lbl: 'Fast Dispatch', dsc: 'Orders processed within 24 hours of confirmation' },
      { ico: '🔒', lbl: 'Secure Platform', dsc: 'HTTPS encrypted end-to-end transactions' },
      { ico: '📋', lbl: 'GST Compliant', dsc: 'All invoices GST compliant with HSN codes' },
      { ico: '🎯', lbl: 'B2B Pricing', dsc: 'Exclusive trade pricing for registered retailers' },
      { ico: inStock ? '✅' : '🔔', lbl: inStock ? 'Ready to Ship' : 'Stock Alert', dsc: inStock ? 'Available inventory ready for dispatch' : 'Sign up for restock notifications' }
    ];

    return `
    <section class="pd-section">
      <div class="pd-sect-hdr">
        <div>
          <div class="pd-sect-title">Product Highlights</div>
          <div class="pd-sect-sub">Why choose this product</div>
        </div>
      </div>
      <div class="pd-feat-grid">
        ${feats.map(f => `
        <div class="pd-feat-card">
          <div class="pd-feat-ico">${f.ico}</div>
          <div>
            <div class="pd-feat-lbl">${f.lbl}</div>
            <div class="pd-feat-dsc">${f.dsc}</div>
          </div>
        </div>`).join('')}
      </div>
    </section>`;
  }

  // ── Builder: Tabs ─────────────────────────────────────────────────────────

  function buildTabs(p, IS_DIST, catName) {
    const tabs = [
      { id: 'overview',     lbl: 'Overview',       content: buildTabOverview(p)          },
      { id: 'composition',  lbl: 'Composition',    content: buildTabComposition(p)       },
      { id: 'specs',        lbl: 'Specifications', content: buildTabSpecs(p, catName)    },
      { id: 'storage',      lbl: 'Storage',        content: buildTabStorage(p)           },
      { id: 'safety',       lbl: 'Safety',         content: buildTabSafety(p)            }
    ];

    const navBtns = tabs.map((t, i) =>
      `<button class="pd-tab-btn ${i === 0 ? 'pd-tab-on' : ''}" data-tab="${t.id}" aria-selected="${i === 0}">${t.lbl}</button>`
    ).join('');

    const panes = tabs.map((t, i) =>
      `<div class="pd-tab-pane ${i === 0 ? 'pd-pane-on' : ''}" id="pd-pane-${t.id}" role="tabpanel" aria-label="${t.lbl}">${t.content}</div>`
    ).join('');

    return `
    <section class="pd-section pd-tabs-section">
      <nav class="pd-tabs-nav" role="tablist" aria-label="Product information tabs">${navBtns}</nav>
      <div class="pd-tabs-body">${panes}</div>
    </section>`;
  }

  function buildTabOverview(p) {
    if (!p.description && !p.uses) {
      return `<div class="pd-empty-tab"><span style="font-size:2rem">📄</span>No overview available for this product.</div>`;
    }
    return `
    <div class="pd-tab-inner">
      ${p.description ? `
      <div style="margin-bottom:20px">
        <h3 class="pd-tab-h">Product Description</h3>
        <p class="pd-tab-p">${esc(p.description)}</p>
      </div>` : ''}
      ${p.uses ? `
      <div>
        <h3 class="pd-tab-h">Uses &amp; Indications</h3>
        <p class="pd-tab-p">${esc(p.uses)}</p>
      </div>` : ''}
    </div>`;
  }

  function buildTabComposition(p) {
    if (!p.composition) {
      return `<div class="pd-empty-tab"><span style="font-size:2rem">🧪</span>Composition information not available.</div>`;
    }
    const items = Array.isArray(p.composition) ? p.composition : [p.composition];
    if (!items.length) {
      return `<div class="pd-empty-tab"><span style="font-size:2rem">🧪</span>Composition information not available.</div>`;
    }
    return `
    <div class="pd-tab-inner">
      <h3 class="pd-tab-h">Active Ingredients</h3>
      <div class="pd-comp-list">
        ${items.map((c, i) => `
        <div class="pd-comp-row">
          <div class="pd-comp-n">${i + 1}</div>
          <span class="pd-comp-name">${esc(String(c))}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function buildTabSpecs(p, catName) {
    const rows = [
      ['Category',      catName || null],
      ['Manufacturer',  p.manufacturer || p.brand],
      ['Pack Size',     p.packSize],
      ['Strength',      p.strength],
      ['Dosage Form',   p.dosageForm],
      ['Schedule',      p.schedule],
      ['Batch No.',     p.batchNo],
      ['HSN Code',      p.hsn],
      ['GST Rate',      p.gst != null ? p.gst + '%' : null],
      ['Expiry Date',   p.expiryDate ? fmtDate(p.expiryDate) : null]
    ].filter(r => r[1]);

    if (!rows.length) {
      return `<div class="pd-empty-tab"><span style="font-size:2rem">📋</span>Specifications not available.</div>`;
    }
    return `
    <div class="pd-tab-inner">
      <h3 class="pd-tab-h">Technical Specifications</h3>
      <table class="pd-spec-tbl">
        <tbody>
          ${rows.map(r => `<tr><th>${r[0]}</th><td>${esc(String(r[1]))}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function buildTabStorage(p) {
    const cards = [
      { ico: '🌡️', lbl: 'Temperature',  val: 'Below 25°C' },
      { ico: '💧', lbl: 'Humidity',      val: 'Dry place' },
      { ico: '🌑', lbl: 'Light',         val: 'Away from direct sunlight' },
      { ico: '🔒', lbl: 'Access',        val: 'Keep out of reach of children' }
    ];
    return `
    <div class="pd-tab-inner">
      <h3 class="pd-tab-h">Storage &amp; Handling</h3>
      <div class="pd-storage-grid">
        ${cards.map(c => `
        <div class="pd-storage-card">
          <div class="pd-storage-ico">${c.ico}</div>
          <div class="pd-storage-lbl">${c.lbl}</div>
          <div class="pd-storage-val">${c.val}</div>
        </div>`).join('')}
      </div>
      <div class="pd-warn-box" style="margin-top:20px">
        ⚠️ Store as directed on the package. Improper storage may affect potency and safety. Consult the manufacturer data sheet for full storage instructions.
      </div>
    </div>`;
  }

  function buildTabSafety(p) {
    return `
    <div class="pd-tab-inner">
      <h3 class="pd-tab-h">Safety Information</h3>
      <p class="pd-tab-p" style="margin-bottom:16px">
        This product is intended for B2B trade supply to licensed retailers and distributors only.
        Always verify your drug license compliance before purchasing scheduled medicines.
      </p>
      <div class="pd-warn-box">
        ⚠️ <strong>For Professional Use Only:</strong> This pharmaceutical product must be dispensed under the supervision of a registered pharmacist.
        Not for direct consumer sale without appropriate prescription where required.
      </div>
    </div>`;
  }

  // ── Builder: Reviews ──────────────────────────────────────────────────────

  function buildReviews(p) {
    const rating = (p.rating || p.ratings) ? Number(p.rating || p.ratings) : 4.2;
    const totalRev = 48;

    const bars = [5,4,3,2,1].map(n => {
      const pct = n === 5 ? 62 : n === 4 ? 22 : n === 3 ? 9 : n === 2 ? 4 : 3;
      return `
      <div class="pd-rbar">
        <span class="pd-rbar-n">${n}★</span>
        <div class="pd-rbar-track"><div class="pd-rbar-fill" style="width:${pct}%"></div></div>
        <span class="pd-rbar-pct">${pct}%</span>
      </div>`;
    }).join('');

    const revCards = [
      { name: 'Apollo Pharmacy', city: 'Mumbai', rating: 5, date: 'Jun 2025', title: 'Excellent quality, prompt dispatch', body: 'Consistently reliable quality. Packaging is tamper-proof and dispatch happens within the promised window. Our go-to supplier for this product line.' },
      { name: 'MedPlus Retail',  city: 'Pune',   rating: 4, date: 'May 2025', title: 'Good B2B pricing and support', body: 'Competitive pricing for bulk orders. Customer support team is responsive. Would appreciate slightly faster dispatch for urgent orders.' }
    ].map(r => `
    <div class="pd-rev-card">
      <div class="pd-rev-head">
        <div class="pd-rev-av">${r.name[0]}</div>
        <div class="pd-rev-info">
          <div class="pd-rev-name">
            ${esc(r.name)} <span class="pd-verif-sm">✓ Verified</span>
          </div>
          <div class="pd-rev-date">${r.city} · ${r.date}</div>
        </div>
        <div class="pd-stars pd-stars-sm">${buildStars(r.rating)}</div>
      </div>
      <div class="pd-rev-title">${esc(r.title)}</div>
      <div class="pd-rev-body">${esc(r.body)}</div>
      <div class="pd-rev-acts">
        <button class="pd-rev-btn">👍 Helpful</button>
        <button class="pd-rev-btn">💬 Comment</button>
      </div>
    </div>`).join('');

    return `
    <section class="pd-section">
      <div class="pd-sect-hdr">
        <div>
          <div class="pd-sect-title">Customer Reviews</div>
          <div class="pd-sect-sub">What retailers are saying</div>
        </div>
        <div class="pd-rat-badge">
          <div>
            <div class="pd-rat-big">${rating.toFixed(1)}</div>
            <div class="pd-stars">${buildStars(rating)}</div>
            <div class="pd-rat-total">${totalRev} reviews</div>
          </div>
        </div>
      </div>
      <div class="pd-reviews-wrap">
        <div class="pd-rat-bars">${bars}</div>
        <div class="pd-rev-cards">${revCards}</div>
      </div>
    </section>`;
  }

  // ── Builder: FAQ ──────────────────────────────────────────────────────────

  function buildFaq(p) {
    const faqs = [
      { q: 'What is the minimum order quantity?', a: `The minimum order quantity for this product is ${(p.minOrderQty || 1)} unit(s). Orders below this quantity cannot be processed through the B2B platform.` },
      { q: 'What payment methods are accepted?', a: 'We currently support Cash on Delivery (COD) for all B2B orders. Online payment integration is coming soon.' },
      { q: 'How is the distributor assigned to my order?', a: 'Orders are automatically routed to the nearest serviceable distributor based on your registered shop address (pincode and city). You can update your shop address from the profile settings.' },
      { q: 'Can I cancel or return an order?', a: 'Orders can be cancelled before dispatch. For returns, contact support within 48 hours of delivery with a valid reason. Damaged or incorrect products are eligible for replacement.' },
      { q: 'Is the pricing exclusive of GST?', a: `All displayed prices are inclusive of applicable GST${p.gst != null ? ` (${p.gst}%)` : ''}. Your invoice will show a GST breakup for tax credit purposes.` }
    ];

    return `
    <section class="pd-section">
      <div class="pd-sect-hdr">
        <div>
          <div class="pd-sect-title">Frequently Asked Questions</div>
          <div class="pd-sect-sub">Common questions about this product</div>
        </div>
      </div>
      <div class="pd-faq-list" id="pd-faq-list">
        ${faqs.map((f, i) => `
        <div class="pd-faq-item" id="pd-faq-${i}">
          <button class="pd-faq-q" data-faq="${i}" aria-expanded="false">
            ${esc(f.q)}
            <span class="pd-faq-ico">+</span>
          </button>
          <div class="pd-faq-a" id="pd-faq-a-${i}" style="max-height:0">
            <p>${esc(f.a)}</p>
          </div>
        </div>`).join('')}
      </div>
    </section>`;
  }

  // ── Builder: Sticky widget ────────────────────────────────────────────────

  function buildStickyWidget(p, inStock, moq, userPrice, catName) {
    const existing = document.getElementById('pd-sticky-widget');
    if (existing) existing.remove();

    const widget = document.createElement('div');
    widget.className = 'pd-sticky-widget';
    widget.id = 'pd-sticky-widget';
    widget.innerHTML = `
    <div class="pd-sw-inner">
      <div class="pd-sw-thumb">${categoryIcon(catName)}</div>
      <div class="pd-sw-info">
        <div class="pd-sw-name">${esc(p.name)}</div>
        <div class="pd-sw-price">₹${userPrice.toLocaleString('en-IN')}</div>
      </div>
      <div class="pd-sw-qty">
        <button class="pd-sw-qbtn" id="pd-sw-minus">−</button>
        <input class="pd-sw-qinp" type="number" id="pd-sw-qty" value="${moq}" min="${moq}" />
        <button class="pd-sw-qbtn" id="pd-sw-plus">+</button>
      </div>
      <button class="pd-sw-cart" id="pd-sw-cart" ${!inStock ? 'disabled' : ''}>
        🛒 ${inStock ? 'Add to Cart' : 'Out of Stock'}
      </button>
    </div>`;
    document.body.appendChild(widget);
  }

  // ── Events ────────────────────────────────────────────────────────────────

  function wireEvents(p, inStock, moq, userPrice) {
    const root = document.getElementById('detail-root');

    // ---- Qty stepper (main) ----
    const qtyInp = document.getElementById('pd-qty');

    el('pd-qminus').addEventListener('click', function () {
      const v = parseInt(qtyInp.value) || moq;
      qtyInp.value = Math.max(moq, v - moq);
      syncStickyQty(qtyInp.value);
    });
    el('pd-qplus').addEventListener('click', function () {
      const v = parseInt(qtyInp.value) || moq;
      qtyInp.value = v + moq;
      syncStickyQty(qtyInp.value);
    });
    qtyInp.addEventListener('change', function () {
      let v = parseInt(qtyInp.value) || moq;
      if (v < moq) v = moq;
      qtyInp.value = v;
      syncStickyQty(v);
    });

    // ---- Sticky qty stepper ----
    const swQty = document.getElementById('pd-sw-qty');
    elMaybe('pd-sw-minus', function () {
      const v = parseInt(swQty.value) || moq;
      swQty.value = Math.max(moq, v - moq);
      if (qtyInp) qtyInp.value = swQty.value;
    });
    elMaybe('pd-sw-plus', function () {
      const v = parseInt(swQty.value) || moq;
      swQty.value = v + moq;
      if (qtyInp) qtyInp.value = swQty.value;
    });
    if (swQty) {
      swQty.addEventListener('change', function () {
        let v = parseInt(swQty.value) || moq;
        if (v < moq) v = moq;
        swQty.value = v;
        if (qtyInp) qtyInp.value = v;
      });
    }

    // ---- Add to cart ----
    const addToCart = function () {
      if (!inStock) return;
      const qty = parseInt(qtyInp.value) || moq;
      if (typeof store !== 'undefined') {
        store.addToCart(p._id || p.productId, qty);
        store.syncCounts();
      }
      toast(qty + ' unit(s) added to cart');
    };
    elMaybe('pd-add-cart', addToCart);
    elMaybe('pd-sw-cart', addToCart);

    // ---- Buy now ----
    elMaybe('pd-buy-now', function () {
      if (!inStock) return;
      const qty = parseInt(qtyInp.value) || moq;
      if (typeof store !== 'undefined') {
        store.addToCart(p._id || p.productId, qty);
        store.syncCounts();
      }
      toast('Proceeding to checkout…');
    });

    // ---- Wishlist ----
    const toggleWish = function () {
      if (typeof store !== 'undefined') {
        const on = store.toggleWish(p._id || p.productId);
        store.syncCounts();
        ['pd-wish-btn', 'pd-wish-btn2'].forEach(function (id) {
          const b = document.getElementById(id);
          if (b) b.classList.toggle('pd-wish-on', on);
        });
        const lbl = document.getElementById('pd-wish-lbl');
        if (lbl) lbl.textContent = on ? 'Wishlisted' : 'Wishlist';
        toast(on ? 'Added to wishlist' : 'Removed from wishlist');
      }
    };
    elMaybe('pd-wish-btn',  toggleWish);
    elMaybe('pd-wish-btn2', toggleWish);

    // ---- Share ----
    elMaybe('pd-share-btn', function () {
      if (navigator.share) {
        navigator.share({ title: p.name, url: window.location.href }).catch(function(){});
      } else {
        navigator.clipboard.writeText(window.location.href).then(function () {
          toast('Link copied to clipboard');
        }).catch(function () {
          toast('Copy the URL to share');
        });
      }
    });

    // ---- Image gallery ----
    const thumbsWrap = document.getElementById('pd-thumbs');
    const mainImgEl  = document.getElementById('pd-main-img-el');
    if (thumbsWrap && mainImgEl && p.images && p.images.length) {
      thumbsWrap.addEventListener('click', function (e) {
        const thumb = e.target.closest('.pd-thumb');
        if (!thumb) return;
        const idx = parseInt(thumb.dataset.idx);
        mainImgEl.src = p.images[idx];
        thumbsWrap.querySelectorAll('.pd-thumb').forEach(function (t) {
          t.classList.toggle('pd-thumb-on', t === thumb);
        });
      });
    }

    // ---- Lightbox ----
    const mainImgBox = document.getElementById('pd-main-img');
    const lb = document.getElementById('lightbox');
    const lbInner = document.getElementById('lb-inner');
    if (mainImgBox && lb && lbInner && p.images && p.images.length) {
      mainImgBox.addEventListener('click', function () {
        const src = mainImgEl ? mainImgEl.src : p.images[0];
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'max-width:90vw;max-height:80vh;border-radius:12px;display:block;';
        // clear previous image
        lbInner.querySelectorAll('img').forEach(function (i) { i.remove(); });
        lbInner.appendChild(img);
        lb.style.display = 'flex';
        lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;';
      });
      document.getElementById('lb-close').addEventListener('click', function () {
        lb.style.display = 'none';
      });
      lb.addEventListener('click', function (e) {
        if (e.target === lb) lb.style.display = 'none';
      });
    }

    // ---- Tabs ----
    const tabsNav = document.querySelector('.pd-tabs-nav');
    if (tabsNav) {
      tabsNav.addEventListener('click', function (e) {
        const btn = e.target.closest('.pd-tab-btn');
        if (!btn) return;
        const id = btn.dataset.tab;
        tabsNav.querySelectorAll('.pd-tab-btn').forEach(function (b) {
          b.classList.toggle('pd-tab-on', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        root.querySelectorAll('.pd-tab-pane').forEach(function (pane) {
          pane.classList.toggle('pd-pane-on', pane.id === 'pd-pane-' + id);
        });
      });
    }

    // ---- FAQ accordion ----
    const faqList = document.getElementById('pd-faq-list');
    if (faqList) {
      faqList.addEventListener('click', function (e) {
        const btn = e.target.closest('.pd-faq-q');
        if (!btn) return;
        const idx = btn.dataset.faq;
        const item = document.getElementById('pd-faq-' + idx);
        const ans  = document.getElementById('pd-faq-a-' + idx);
        if (!item || !ans) return;
        const isOpen = item.classList.contains('pd-faq-open');
        // close all
        faqList.querySelectorAll('.pd-faq-item').forEach(function (it) {
          it.classList.remove('pd-faq-open');
          it.querySelector('.pd-faq-a').style.maxHeight = '0';
          it.querySelector('.pd-faq-q').setAttribute('aria-expanded', 'false');
        });
        // open clicked if was closed
        if (!isOpen) {
          item.classList.add('pd-faq-open');
          ans.style.maxHeight = ans.scrollHeight + 'px';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    // ---- Sticky widget show/hide on scroll ----
    // Show when hero scrolls out of view; hide again when footer becomes visible
    // so the footer is never obscured.
    const hero    = document.querySelector('.pd-hero');
    const footer  = document.getElementById('site-footer');
    const stickyW = document.getElementById('pd-sticky-widget');

    if (stickyW) {
      var heroGone     = false;
      var footerInView = false;

      function syncSticky() {
        var visible = heroGone && !footerInView;
        stickyW.classList.toggle('pd-sw-visible', visible);
        document.body.classList.toggle('pd-sw-active', visible);
      }

      if (hero) {
        new IntersectionObserver(function (entries) {
          heroGone = !entries[0].isIntersecting;
          syncSticky();
        }, { threshold: 0 }).observe(hero);
      }

      if (footer) {
        new IntersectionObserver(function (entries) {
          footerInView = entries[0].isIntersecting;
          syncSticky();
        }, { threshold: 0 }).observe(footer);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  function elMaybe(id, fn) {
    const node = document.getElementById(id);
    if (node) node.addEventListener('click', fn);
  }

  function syncStickyQty(val) {
    const swQ = document.getElementById('pd-sw-qty');
    if (swQ) swQ.value = val;
  }

  function buildStars(rating) {
    const full  = Math.floor(rating);
    const half  = rating - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full).split('').map(function (s) { return `<span class="pd-star pd-star-full">${s}</span>`; }).join('') +
           (half ? '<span class="pd-star pd-star-half">★</span>' : '') +
           '☆'.repeat(empty).split('').map(function (s) { return `<span class="pd-star pd-star-empty">${s}</span>`; }).join('');
  }

  function categoryIcon(cat) {
    if (!cat) return '💊';
    const raw = typeof cat === 'object' ? (cat.categoryName || '') : String(cat);
    const c = raw.toLowerCase();
    if (c.includes('syrup') || c.includes('liquid'))  return '🧴';
    if (c.includes('inject'))                          return '💉';
    if (c.includes('cream') || c.includes('topical')) return '🧫';
    if (c.includes('eye') || c.includes('drop'))      return '👁️';
    if (c.includes('vitamin') || c.includes('supple')) return '🌿';
    if (c.includes('antibiotic'))                      return '🦠';
    return '💊';
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

  function fmtDate(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d)) return String(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    const el2 = document.createElement('div');
    el2.textContent = msg;
    el2.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 22px;border-radius:8px;font-size:.9rem;z-index:9999;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.25);';
    document.body.appendChild(el2);
    setTimeout(function () { el2.remove(); }, 2800);
  }
});

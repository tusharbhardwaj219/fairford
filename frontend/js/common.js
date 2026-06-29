/* =====================================================================
   common.js — MediBridge B2B Pharma Marketplace
   Shared, reusable helpers used by both pages:
     • SVG product illustrations (category-based, no external images)
     • Header & footer injection (single source of truth)
     • Star rating renderer
     • Toast notifications
     • Tiny in-memory cart / wishlist store
   NOTE: cart/wishlist are kept in-memory for the demo. For production,
   persist with localStorage or a /api/cart endpoint (see store object).
   ===================================================================== */

/* ----------  ICONS (inline SVG strings)  ---------- */
const ICONS = {
  cart:   '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart-icon lucide-shopping-cart"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
  heart:  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  star:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.26L21.6 9.27l-4.8 4.68 1.13 6.6L12 17.77 6.07 20.55l1.13-6.6-4.8-4.68 6.7-1.01L12 2z"/></svg>',
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  eye:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  pill:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><path d="m8.5 8.5 7 7"/></svg>',
  x:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  bolt:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  award:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/></svg>',
  verify: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3z"/></svg>',
  truck:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  pin:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  phone:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  mail:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  doc:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><path d="M12 15V3"/></svg>',
  share:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>',
  chev:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  thermo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
  info:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  flask:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/><path d="M7.5 15h9"/></svg>',
  alert:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>'
};

/* ----------  PRODUCT IMAGE: category-based SVG illustration  ----------
   Returns an <svg> string. Keeps the marketplace image-perfect with zero
   external/broken assets, and gives every category a recognisable form. */
function productImageSVG(category) {
  const c1 = "#16a085", c2 = "#0a4d42", cap = "#0e6b5b", glass = "#bfe6dd";
  switch (category) {
    case "Tablets": // blister pack
      return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <img src="image/vic.jpg" alt="vitamin c tablet" width="100%" height="100%">
        <rect x="14" y="18" width="92" height="64" rx="8" fill="#cfe8e1"/>
        <rect x="14" y="18" width="92" height="64" rx="8" fill="none" stroke="${c2}" stroke-width="2.5" opacity=".5"/>
        ${[0,1,2].map(r=>[0,1,2,3].map(col=>`<circle cx="${28+col*22}" cy="${34+r*18}" r="7.5" fill="#fff"/><circle cx="${28+col*22}" cy="${34+r*18}" r="7.5" fill="none" stroke="${c1}" stroke-width="2"/><line x1="${28+col*22-7.5}" y1="${34+r*18}" x2="${28+col*22+7.5}" y2="${34+r*18}" stroke="${c1}" stroke-width="1.4" opacity=".6"/>`).join("")).join("")}
      </svg>`;
    case "Capsules": // two capsules
      return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-28 60 50)">
          <rect x="22" y="40" width="76" height="22" rx="11" fill="#fff" stroke="${c2}" stroke-width="2"/>
          <rect x="22" y="40" width="40" height="22" rx="11" fill="${c1}"/>
          <rect x="26" y="44" width="14" height="6" rx="3" fill="#fff" opacity=".4"/>
        </g>
        <g transform="rotate(-28 60 50) translate(0 26)">
          <rect x="22" y="40" width="76" height="22" rx="11" fill="#fff" stroke="${c2}" stroke-width="2"/>
          <rect x="22" y="40" width="40" height="22" rx="11" fill="${cap}"/>
          <rect x="26" y="44" width="14" height="6" rx="3" fill="#fff" opacity=".4"/>
        </g>
      </svg>`;
    case "Syrups": // bottle
      return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="48" y="8" width="24" height="14" rx="3" fill="${c2}"/>
        <rect x="44" y="20" width="32" height="8" rx="2" fill="${cap}"/>
        <path d="M44 28 h32 a8 8 0 0 1 8 8 v48 a8 8 0 0 1-8 8 H44 a8 8 0 0 1-8-8 V36 a8 8 0 0 1 8-8z" fill="${glass}" stroke="${c2}" stroke-width="2.5"/>
        <path d="M40 60 h40 v24 a6 6 0 0 1-6 6 H46 a6 6 0 0 1-6-6 z" fill="${c1}"/>
        <rect x="44" y="36" width="24" height="16" rx="3" fill="#fff" opacity=".7"/>
        <line x1="48" y1="40" x2="62" y2="40" stroke="${c1}" stroke-width="2"/>
        <line x1="48" y1="46" x2="58" y2="46" stroke="${c1}" stroke-width="2" opacity=".6"/>
      </svg>`;
    case "Injections": // vial + syringe
      return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="22" y="22" width="26" height="56" rx="6" fill="${glass}" stroke="${c2}" stroke-width="2.5"/>
        <rect x="22" y="50" width="26" height="28" rx="0" fill="${c1}"/>
        <rect x="20" y="16" width="30" height="9" rx="3" fill="${cap}"/>
        <rect x="24" y="10" width="22" height="8" rx="2" fill="${c2}"/>
        <g transform="rotate(35 86 50)">
          <rect x="64" y="42" width="44" height="16" rx="3" fill="#fff" stroke="${c2}" stroke-width="2"/>
          <rect x="64" y="42" width="20" height="16" fill="${c1}" opacity=".5"/>
          <rect x="104" y="46" width="12" height="8" rx="2" fill="${c2}"/>
          <line x1="116" y1="50" x2="130" y2="50" stroke="${c2}" stroke-width="2"/>
          <rect x="58" y="44" width="6" height="12" rx="2" fill="${cap}"/>
        </g>
      </svg>`;
    case "Ointments": // tube
      return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="50" y="10" width="20" height="12" rx="3" fill="${c2}"/>
        <path d="M40 22 h40 l-4 60 a6 6 0 0 1-6 5 H50 a6 6 0 0 1-6-5 z" fill="#eef6f3" stroke="${c2}" stroke-width="2.5"/>
        <rect x="44" y="30" width="32" height="22" rx="4" fill="${c1}"/>
        <path d="M44 82 h32 l-2 8 H46 z" fill="${cap}"/>
        <line x1="50" y1="38" x2="70" y2="38" stroke="#fff" stroke-width="2.4"/>
        <line x1="50" y1="44" x2="64" y2="44" stroke="#fff" stroke-width="2.4" opacity=".7"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="80" height="60" rx="10" fill="${c1}"/></svg>`;
  }
}

/* ----------  STAR RATING renderer  ---------- */
function renderStars(rating) {
  let out = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    out += `<span class="${i <= Math.round(rating) ? '' : 'empty'}">${ICONS.star}</span>`;
  }
  return out + '</span>';
}

/* ----------  CURRENCY  ---------- */
function inr(n) { return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function badgeClass(status) {
  return status === "In Stock" ? "in" : status === "Low Stock" ? "low" : "out";
}

/* ----------  CART / WISHLIST STORE (localStorage-backed)  ---------- */
const store = {
  get cart() {
    try { return JSON.parse(localStorage.getItem('ff_cart') || '[]'); } catch(e) { return []; }
  },
  _setCart: function(v) { localStorage.setItem('ff_cart', JSON.stringify(v)); },
  get wishlist() {
    try { return JSON.parse(localStorage.getItem('ff_wish') || '[]'); } catch(e) { return []; }
  },
  _setWish: function(v) { localStorage.setItem('ff_wish', JSON.stringify(v)); },

  addToCart: function(id, qty) {
    var cart = this.cart;
    var idx = cart.findIndex(function(x) { return x.id === String(id); });
    if (idx >= 0) { cart[idx].qty += (qty || 1); }
    else { cart.push({ id: String(id), qty: qty || 1 }); }
    this._setCart(cart);
    this.syncCounts();
    if (this._openPanel) this._openPanel('ff-cart-panel');
    this._refreshCartPanel();
  },

  removeFromCart: function(id) {
    this._setCart(this.cart.filter(function(x) { return x.id !== String(id); }));
    this.syncCounts();
    this._refreshCartPanel();
  },

  updateCartQty: function(id, qty) {
    if (qty < 1) { this.removeFromCart(id); return; }
    var cart = this.cart;
    var item = cart.find(function(x) { return x.id === String(id); });
    if (item) { item.qty = qty; this._setCart(cart); }
    this.syncCounts();
    this._refreshCartPanel();
  },

  toggleWish: function(id) {
    var wish = this.wishlist;
    var i = wish.indexOf(String(id));
    if (i >= 0) {
      wish.splice(i, 1); this._setWish(wish);
      this.syncCounts(); this._refreshWishPanel(); return false;
    }
    wish.push(String(id)); this._setWish(wish);
    this.syncCounts();
    if (this._openPanel) this._openPanel('ff-wish-panel');
    this._refreshWishPanel();
    return true;
  },

  removeFromWish: function(id) {
    this._setWish(this.wishlist.filter(function(x) { return x !== String(id); }));
    this.syncCounts();
    this._refreshWishPanel();
  },

  moveToCart: function(id) {
    this.addToCart(id, 1);
    this._setWish(this.wishlist.filter(function(x) { return x !== String(id); }));
    this.syncCounts();
    this._refreshWishPanel();
  },

  syncCounts: function() {
    var cartTotal = this.cart.reduce(function(s, x) { return s + x.qty; }, 0);
    var wishTotal = this.wishlist.length;
    var cEl = document.getElementById('cartCount');
    var wEl = document.getElementById('wishlistCount');
    if (cEl) { cEl.textContent = cartTotal; cEl.classList.toggle('empty', cartTotal === 0); }
    if (wEl) { wEl.textContent = wishTotal; wEl.classList.toggle('empty', wishTotal === 0); }
    var cpEl = document.getElementById('ff-cart-count');
    var wpEl = document.getElementById('ff-wish-count');
    if (cpEl) cpEl.textContent = cartTotal + (cartTotal === 1 ? ' item' : ' items');
    if (wpEl) wpEl.textContent = wishTotal + (wishTotal === 1 ? ' item' : ' items');
  },

  _products: function() {
    return typeof getAllProducts === 'function' ? getAllProducts() : [];
  },

  _refreshCartPanel: async function() {
    var panel = document.getElementById('ff-cart-panel');
    if (!panel) return;
    var products;
    try { products = typeof getAllProducts === 'function' ? await getAllProducts() : []; }
    catch(e) { products = []; }

    // Purge cart entries whose IDs no longer exist in the catalogue.
    var cart = this.cart;
    var validCart = cart.filter(function(item) {
      return products.some(function(x) { return x.id === item.id; });
    });
    if (validCart.length !== cart.length) {
      this._setCart(validCart);
      this.syncCounts();
      cart = validCart;
    }

    var body = document.getElementById('ff-cart-body');
    var foot = document.getElementById('ff-cart-foot');
    var count = document.getElementById('ff-cart-count');
    var total = cart.reduce(function(s, x) { return s + x.qty; }, 0);
    if (count) count.textContent = total + (total === 1 ? ' item' : ' items');

    var SVG_TRASH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
    var SVG_MINUS = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>';
    var SVG_PLUS  = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    var SVG_CART  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>';

    if (!cart.length) {
      body.innerHTML =
        '<div class="fpanel-empty">' +
          '<div class="fpanel-empty-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
              '<path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>' +
            '</svg>' +
          '</div>' +
          '<p class="fpanel-empty-big">Your cart is empty</p>' +
          '<p class="fpanel-empty-sub">Browse our catalogue and add products to your order.</p>' +
          '<a href="product.html" class="fpanel-empty-btn">Browse Products</a>' +
        '</div>';
      foot.innerHTML = '';
      return;
    }

    var subtotal = 0, gstTotal = 0, html = '';
    cart.forEach(function(item) {
      var p = products.find(function(x) { return x.id === item.id; });
      if (!p) return;
      var lineTotal = p.retailerPrice * item.qty;
      subtotal += lineTotal;
      gstTotal += (lineTotal * (p.gst || 12)) / 100;
      var thumb = p.image
        ? '<img src="' + p.image + '" alt="' + p.name + '" class="fline-img">'
        : '<div class="fline-svg">' + (typeof productImageSVG === 'function' ? productImageSVG(p.category) : p.name.charAt(0)) + '</div>';
      html +=
        '<div class="fline">' +
          '<div class="fline-thumb">' + thumb + '</div>' +
          '<div class="fline-info">' +
            '<p class="fline-name">' + p.name + '</p>' +
            '<p class="fline-comp">' + p.brand + (p.packSize ? ' · ' + p.packSize : '') + '</p>' +
            '<p class="fline-rate">' + inr(p.retailerPrice).replace('.00','') + ' / unit · MOQ ' + (p.moq || 1) + '</p>' +
            '<div class="fqty">' +
              '<button class="fqty-btn" data-qminus="' + p.id + '" aria-label="Decrease">' + SVG_MINUS + '</button>' +
              '<input class="fqty-inp" type="number" value="' + item.qty + '" min="1" data-qid="' + p.id + '" aria-label="Quantity" />' +
              '<button class="fqty-btn" data-qplus="' + p.id + '" aria-label="Increase">' + SVG_PLUS + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="fline-right">' +
            '<span class="fline-total">' + inr(lineTotal).replace('.00','') + '</span>' +
            '<button class="fline-remove" data-remove="' + p.id + '" aria-label="Remove item">' + SVG_TRASH + '</button>' +
          '</div>' +
        '</div>';
    });
    body.innerHTML = html;

    var grand = subtotal + gstTotal;
    foot.innerHTML =
      '<div class="ftotals">' +
        '<div class="ftotals-row"><span>Subtotal</span><span>' + inr(subtotal).replace('.00','') + '</span></div>' +
        '<div class="ftotals-row"><span>Estimated GST</span><span>' + inr(gstTotal).replace('.00','') + '</span></div>' +
        '<div class="ftotals-row grand"><span>Grand Total</span><span>' + inr(grand).replace('.00','') + '</span></div>' +
      '</div>' +
      '<button class="fbtn-checkout">' + SVG_CART + ' Proceed to Checkout</button>' +
      '<p class="ffoot-note">Min. order quantities apply · Prices in INR</p>';
  },

  _refreshWishPanel: async function() {
    var panel = document.getElementById('ff-wish-panel');
    if (!panel) return;
    var products;
    try { products = typeof getAllProducts === 'function' ? await getAllProducts() : []; }
    catch(e) { products = []; }

    // Purge wishlist entries whose IDs no longer exist in the catalogue.
    var wish = this.wishlist;
    var validWish = wish.filter(function(id) {
      return products.some(function(x) { return x.id === id; });
    });
    if (validWish.length !== wish.length) {
      this._setWish(validWish);
      this.syncCounts();
      wish = validWish;
    }

    var body = document.getElementById('ff-wish-body');
    var foot = document.getElementById('ff-wish-foot');
    var count = document.getElementById('ff-wish-count');
    if (count) count.textContent = wish.length + (wish.length === 1 ? ' item' : ' items');

    var SVG_TRASH = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
    var SVG_CART  = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>';
    var SVG_CART_LG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>';

    if (!wish.length) {
      body.innerHTML =
        '<div class="fpanel-empty">' +
          '<div class="fpanel-empty-icon fpanel-empty-icon--heart">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
            '</svg>' +
          '</div>' +
          '<p class="fpanel-empty-big">No saved products</p>' +
          '<p class="fpanel-empty-sub">Tap the heart icon on any product to save it here.</p>' +
          '<a href="product.html" class="fpanel-empty-btn">Browse Products</a>' +
        '</div>';
      foot.innerHTML = '';
      return;
    }

    var html = '';
    wish.forEach(function(id) {
      var p = products.find(function(x) { return x.id === id; });
      if (!p) return;
      var thumb = p.image
        ? '<img src="' + p.image + '" alt="' + p.name + '" class="fline-img">'
        : '<div class="fline-svg">' + (typeof productImageSVG === 'function' ? productImageSVG(p.category) : p.name.charAt(0)) + '</div>';
      html +=
        '<div class="fwish-line">' +
          '<div class="fline-thumb">' + thumb + '</div>' +
          '<div class="fline-info">' +
            '<p class="fline-name">' + p.name + '</p>' +
            '<p class="fline-comp">' + p.brand + (p.packSize ? ' · ' + p.packSize : '') + '</p>' +
            '<p class="fline-rate fline-rate--price">' + inr(p.retailerPrice).replace('.00','') + '</p>' +
          '</div>' +
          '<div class="fwish-actions">' +
            '<button class="fwish-move" data-wish-cart="' + id + '">' + SVG_CART + ' Add to Cart</button>' +
            '<button class="fline-remove" data-wish-remove="' + id + '" aria-label="Remove from wishlist">' + SVG_TRASH + '</button>' +
          '</div>' +
        '</div>';
    });
    body.innerHTML = html;
    foot.innerHTML =
      '<button class="fbtn-checkout fbtn-add-all">' + SVG_CART_LG + ' Add All to Cart</button>';
  }
};

/* ----------  TOAST notifications  ---------- */
function toast(msg) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="ti">${ICONS.check}</span>${msg}`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 320); }, 2600);
}

/* ----------  SHARED HEADER  ---------- */
function renderHeader(active) {
  function navCls(key) { return 'nav-link' + (active === key ? ' is-active' : ''); }

  return `
<div class="topbar" role="region" aria-label="Contact and support information">
  <div class="topbar__container">
    <ul class="topbar__contact" aria-label="Contact information">
      <li class="topbar__item">
        <a href="tel:+919958584020" class="topbar__link" aria-label="Call us">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>
          <span>+91 8595939723</span>
        </a>
      </li>
      <li class="topbar__divider" aria-hidden="true"></li>
      <li class="topbar__item">
        <a href="mailto:info@fairfordpharma.com" class="topbar__link" aria-label="Email us">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
          <span>info@fairfordpharma.com</span>
        </a>
      </li>
      <li class="topbar__divider" aria-hidden="true"></li>
      <li class="topbar__item">
        <a href="#distributor-support" class="topbar__link">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.63L18.3 9.37a1 1 0 0 0-.79-.37H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
          <span>Distributor support</span>
        </a>
      </li>
      <li class="topbar__divider" aria-hidden="true"></li>
      <li class="topbar__item">
        <a href="#retailer-support" class="topbar__link">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
          <span>Retailer support</span>
        </a>
      </li>
    </ul>
    <div class="topbar__actions">
      <a href="distributor-inventory.html" class="topbar__cta">
        <span>Become a distributor</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>


      <ul class="topbar__social" aria-label="Social media">
        <li><a href="https://www.facebook.com/profile.php?id=61550892159031" class="topbar__social-link" aria-label="Facebook" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a></li>
        <li><a href="https://www.linkedin.com/company/fairfordpharma" class="topbar__social-link" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a></li>
        <li><a href="https://x.com" class="topbar__social-link" aria-label="X (formerly Twitter)" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a></li>
        <li><a href="https://www.instagram.com/fairfordpharma/" class="topbar__social-link" aria-label="Instagram" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a></li>
        <li><a href="https://www.youtube.com/@user-jm4zy6du8f" class="topbar__social-link" aria-label="YouTube" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff"/></svg></a></li>
      </ul>
    </div>
  </div>
</div>

<header class="header" id="siteHeader">
  <div class="container header-inner">
    <a href="index.html" class="logo" aria-label="Fair Ford Pharma home">
      <span class="logo-mark" aria-hidden="true">
        <img src=https://res.cloudinary.com/dp4yririh/image/upload/v1781166637/LOGO_ja5rle.png alt="Fair Ford Pharmaceuticals Pvt. Ltd. logo" width="60" height="60">
      </span>
      <span class="logo-text">
        <span class="logo-name">Fair Ford</span>
        <span class="logo-tag"> Pharmaceuticals </span>
      </span>
    </a>

    <nav class="nav-desktop" aria-label="Primary">
      <ul class="nav-list">
        <li><a href="index.html" class="${navCls('home')}">Home</a></li>
        <li><a href="product.html" class="${navCls('products')}">Products</a></li>
        <li><a href="About.html" class="${navCls('about')}" target="_blank">About</a></li>
        <li><a href="contactus.html" class="${navCls('contact')}" target="_blank">Contact</a></li>
        <li><a href="uphaar.html" class="nav-link nav-link--promo"><span class="promo-dot" aria-hidden="true"></span>Uphaar</a></li>
      </ul>
    </nav>

    <div class="actions">
      <a href="search.html" target="_self">
        <button class="icon-btn" data-action="search" aria-label="Search products">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </button>
      </a>
      <button class="icon-btn" id="wishlistBtn" data-action="wishlist" aria-label="Wishlist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="badge empty" id="wishlistCount">0</span>
      </button>
      <button class="icon-btn" id="cartBtn" data-action="cart" aria-label="Shopping cart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
        <span class="badge empty" id="cartCount">0</span>
      </button>
      <button class="icon-btn" data-action="account" aria-label="My account">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </button>
      <button class="btn-signin" id="loginNavBtn" type="button" onclick="window.location.href='login&signup.html'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>
        Login
      </button>
      <button class="btn-signin btn-logout" id="logoutNavBtn" type="button" style="display:none;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Logout
      </button>
      <button class="hamburger" id="hamburgerBtn" aria-label="Open menu" aria-expanded="false" aria-controls="mobileDrawer">
        <span class="hamburger-box">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </span>
      </button>
    </div>
  </div>
</header>

<div class="drawer-overlay" id="drawerOverlay"></div>
<aside class="drawer" id="mobileDrawer" aria-label="Mobile navigation" aria-hidden="true">
  <div class="drawer-header">
    <a href="index.html" class="logo">
      <span class="logo-mark" aria-hidden="true">
        <img src=https://res.cloudinary.com/dp4yririh/image/upload/v1781166637/LOGO_ja5rle.png alt="Fair Ford Pharmaceuticals Pvt. Ltd. logo" width="60" height="60">
      </span>
      <span class="logo-text">
        <span class="logo-name">Fair Ford</span>
        <span class="logo-tag">&bull; Health care</span>
      </span>
    </a>
    <button class="drawer-close" id="drawerClose" aria-label="Close menu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <nav class="drawer-nav" aria-label="Mobile primary">
    <a href="index.html" class="drawer-link">Home<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
    <a href="product.html" class="drawer-link">Products<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
    <a href="About.html" class="drawer-link">About Us<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
    <a href="contactus.html" class="drawer-link">Contact<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
    <a href="uphaar.html" class="drawer-link drawer-link--promo">Uphaar<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
    <div class="drawer-section-title">Account</div>
    <a href="#" class="drawer-link">Wishlist<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
    <a href="#" class="drawer-link" id="drawerProfileLink">My Profile<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
  </nav>
  <div class="drawer-footer">
    <button class="drawer-cta" id="drawerLoginBtn" type="button" onclick="window.location.href='login&signup.html'">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>
      Login
    </button>
    <button class="drawer-cta drawer-logout" id="drawerLogoutBtn" type="button" style="display:none;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
      Logout
    </button>
    <p class="drawer-meta">For verified retailers &amp; distributors</p>
  </div>
</aside>`;
}

/* ----------  HEADER INITIALISER  ----------
   Call once after renderHeader() is injected into the DOM. */
function initHeader() {
  // Scroll → glassmorphism density change
  const hdr = document.getElementById('siteHeader');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('is-scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile drawer
  const hamburger = document.getElementById('hamburgerBtn');
  const drawer    = document.getElementById('mobileDrawer');
  const overlay   = document.getElementById('drawerOverlay');
  const closeBtn  = document.getElementById('drawerClose');

  function openDrawer() {
    if (!drawer) return;
    hamburger && hamburger.classList.add('is-active');
    hamburger && hamburger.setAttribute('aria-expanded', 'true');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay && overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (!drawer) return;
    hamburger && hamburger.classList.remove('is-active');
    hamburger && hamburger.setAttribute('aria-expanded', 'false');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay && overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  hamburger && hamburger.addEventListener('click', function () {
    drawer && drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
  });
  closeBtn && closeBtn.addEventListener('click', closeDrawer);
  overlay  && overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  // Login / logout state (keyed from localStorage under 'ff_user')
  const isLoggedIn = !!(localStorage.getItem('ff_user') || sessionStorage.getItem('ff_user'));
  const loginNav    = document.getElementById('loginNavBtn');
  const logoutNav   = document.getElementById('logoutNavBtn');
  const loginDraw   = document.getElementById('drawerLoginBtn');
  const logoutDraw  = document.getElementById('drawerLogoutBtn');

  if (isLoggedIn) {
    if (loginNav)   loginNav.style.display  = 'none';
    if (logoutNav)  logoutNav.style.display  = '';
    if (loginDraw)  loginDraw.style.display  = 'none';
    if (logoutDraw) logoutDraw.style.display = '';
  }

  function doLogout() {
    if (window.showLogoutConfirm) {
      window.showLogoutConfirm(function () {
        window.lcDoLogout('index.html');
      });
    } else {
      localStorage.removeItem('ff_user');
      localStorage.removeItem('ff_token');
      sessionStorage.removeItem('ff_user');
      window.location.href = 'index.html';
    }
  }
  logoutNav  && logoutNav.addEventListener('click', doLogout);
  logoutDraw && logoutDraw.addEventListener('click', doLogout);

  // Account / profile button → role-based dashboard redirect
  function goToDashboard() {
    var userStr = localStorage.getItem('ff_user');
    if (!userStr) { window.location.href = 'login&signup.html'; return; }
    try {
      var user = JSON.parse(userStr);
      if (user.role === 'ret')      window.location.href = 'retailer.html';
      else                          window.location.href = 'index.html';
    } catch (e) {
      window.location.href = 'login&signup.html';
    }
  }

  var accountBtn      = document.querySelector('[data-action="account"]');
  var drawerProfileLink = document.getElementById('drawerProfileLink');
  accountBtn      && accountBtn.addEventListener('click', goToDashboard);
  drawerProfileLink && drawerProfileLink.addEventListener('click', function (e) {
    e.preventDefault();
    goToDashboard();
  });

  // Sync cart/wishlist badge counts
  store.syncCounts();

  // Cross-tab sync: when another tab mutates ff_cart or ff_wish, refresh
  // the badges + open panels on this tab so they don't go stale. Only wire
  // this once even if initHeader is called more than once.
  if (!window.__ffStorageSync) {
    window.__ffStorageSync = true;
    window.addEventListener('storage', function (e) {
      if (e.key !== 'ff_cart' && e.key !== 'ff_wish' && e.key !== null) return;
      store.syncCounts();
      store._refreshCartPanel();
      store._refreshWishPanel();
    });
  }

  // Inject cart & wishlist slide panels
  initPanels();
}

/* ----------  CART / WISHLIST SLIDE PANELS  ---------- */
function initPanels() {
  if (document.getElementById('ff-panel-overlay')) return; // already initialised

  // Backdrop overlay
  var overlay = document.createElement('div');
  overlay.className = 'fpanel-overlay';
  overlay.id = 'ff-panel-overlay';
  document.body.appendChild(overlay);

  // Cart panel
  var cartPanel = document.createElement('div');
  cartPanel.className = 'fpanel';
  cartPanel.id = 'ff-cart-panel';
  cartPanel.setAttribute('role', 'dialog');
  cartPanel.setAttribute('aria-modal', 'true');
  cartPanel.setAttribute('aria-label', 'Shopping Cart');
  cartPanel.innerHTML =
    '<div class="fpanel-head">' +
      '<h2 class="fpanel-title">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>' +
        ' Order Cart <span class="fpanel-count" id="ff-cart-count">0 items</span>' +
      '</h2>' +
      '<button class="fpanel-close" id="ff-cart-close" aria-label="Close cart">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="fpanel-body" id="ff-cart-body"></div>' +
    '<div class="fpanel-foot" id="ff-cart-foot"></div>';
  document.body.appendChild(cartPanel);

  // Wishlist panel
  var wishPanel = document.createElement('div');
  wishPanel.className = 'fpanel';
  wishPanel.id = 'ff-wish-panel';
  wishPanel.setAttribute('role', 'dialog');
  wishPanel.setAttribute('aria-modal', 'true');
  wishPanel.setAttribute('aria-label', 'Wishlist');
  wishPanel.innerHTML =
    '<div class="fpanel-head">' +
      '<h2 class="fpanel-title">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        ' Wishlist <span class="fpanel-count" id="ff-wish-count">0 items</span>' +
      '</h2>' +
      '<button class="fpanel-close" id="ff-wish-close" aria-label="Close wishlist">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="fpanel-body" id="ff-wish-body"></div>' +
    '<div class="fpanel-foot" id="ff-wish-foot"></div>';
  document.body.appendChild(wishPanel);

  // Open / close helpers
  function openPanel(id) {
    document.getElementById(id).classList.add('is-open');
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  // Expose so addToCart / toggleWish can auto-open the panel
  store._openPanel = openPanel;
  function closeAll() {
    cartPanel.classList.remove('is-open');
    wishPanel.classList.remove('is-open');
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // Header button wiring — delegated on body so it survives any header re-render
  document.body.addEventListener('click', function(e) {
    if (e.target.closest('#cartBtn')) {
      e.stopPropagation();
      store._refreshCartPanel();
      openPanel('ff-cart-panel');
    } else if (e.target.closest('#wishlistBtn')) {
      e.stopPropagation();
      store._refreshWishPanel();
      openPanel('ff-wish-panel');
    }
  });
  document.getElementById('ff-cart-close').addEventListener('click', closeAll);
  document.getElementById('ff-wish-close').addEventListener('click', closeAll);
  overlay.addEventListener('click', closeAll);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeAll(); });

  // Cart body — qty buttons + remove (event delegation on static parent)
  document.getElementById('ff-cart-body').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-qminus],[data-qplus],[data-remove]');
    if (!btn) return;
    if (btn.hasAttribute('data-qminus')) {
      var qid = btn.getAttribute('data-qminus');
      var qitem = store.cart.find(function(x) { return x.id === qid; });
      if (qitem) store.updateCartQty(qid, qitem.qty - 1);
    } else if (btn.hasAttribute('data-qplus')) {
      var qid2 = btn.getAttribute('data-qplus');
      var qitem2 = store.cart.find(function(x) { return x.id === qid2; });
      if (qitem2) store.updateCartQty(qid2, qitem2.qty + 1);
    } else if (btn.hasAttribute('data-remove')) {
      store.removeFromCart(btn.getAttribute('data-remove'));
    }
  });

  // Cart body — qty text input change
  document.getElementById('ff-cart-body').addEventListener('change', function(e) {
    var inp = e.target.closest('[data-qid]');
    if (!inp) return;
    var v = parseInt(inp.value, 10);
    if (!isNaN(v)) store.updateCartQty(inp.getAttribute('data-qid'), v);
  });

  // Cart foot — checkout button. For signed-in retailers we POST directly to
  // /api/orders so they can complete a cash-on-delivery order from any page
  // that has the shared cart panel (product, search, etc.) without bouncing
  // through retailer.html. Guests are sent to login; mis-configured retailers
  // (no shop address) are sent to retailer.html to fill it in.
  document.getElementById('ff-cart-foot').addEventListener('click', async function (e) {
    var btn = e.target.closest('.fbtn-checkout');
    if (!btn) return;

    var token   = localStorage.getItem('ff_token');
    var userStr = localStorage.getItem('ff_user');
    var user    = null;
    try { user = userStr ? JSON.parse(userStr) : null; } catch (err) { user = null; }

    if (!token || !user) {
      localStorage.setItem('ff_redirect', window.location.pathname.replace(/^\//, '') || 'index.html');
      toast('Please sign in as a retailer to place an order.');
      setTimeout(function () { window.location.href = 'login&signup.html'; }, 900);
      return;
    }
    if (user.role !== 'ret') {
      toast('Only retailer accounts can place storefront orders.');
      return;
    }

    var cart = store.cart;
    if (!cart.length) { toast('Your cart is empty'); return; }

    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Placing…';

    try {
      var res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          items: cart.map(function (c) { return { product: c.id, quantity: c.qty }; }),
          deliveryPriority: 'standard',
        }),
      });
      var data = await res.json().catch(function () { return {}; });

      if (!res.ok || !data.success) {
        var msg = data.message || ('Order failed (HTTP ' + res.status + ')');
        // Address missing → drop them on the retailer page to set it.
        if (/address|pincode|city/i.test(msg)) {
          toast('Please set your shop address first.');
          localStorage.setItem('ff_cart', JSON.stringify(cart)); // preserve cart
          setTimeout(function () { window.location.href = 'retailer.html'; }, 1000);
          return;
        }
        // Account pending KYC → same destination, with banner shown there.
        if (/KYC|active|approval/i.test(msg)) {
          toast('Your account is pending approval. Track status in your dashboard.');
          setTimeout(function () { window.location.href = 'retailer.html'; }, 1000);
          return;
        }
        toast('⚠ ' + msg);
        return;
      }

      // Success — clear cart locally + UI.
      store._setCart([]);
      store.syncCounts();
      store._refreshCartPanel();
      var num = (data.order && data.order.orderNumber) ? ' ' + data.order.orderNumber : '';
      toast('✓ Order' + num + ' placed — admin approval pending.');
    } catch (err) {
      toast('⚠ ' + (err.message || 'Network error'));
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  // Wishlist body — move to cart + remove (event delegation)
  document.getElementById('ff-wish-body').addEventListener('click', function(e) {
    var wc = e.target.closest('[data-wish-cart]');
    var wr = e.target.closest('[data-wish-remove]');
    if (wc) { store.moveToCart(wc.getAttribute('data-wish-cart')); toast('Moved to cart'); }
    if (wr) { store.removeFromWish(wr.getAttribute('data-wish-remove')); }
  });

  // Wishlist foot — add all to cart
  document.getElementById('ff-wish-foot').addEventListener('click', function(e) {
    if (e.target.closest('.fbtn-add-all')) {
      var ids = store.wishlist.slice();
      ids.forEach(function(id) { store.moveToCart(id); });
      toast('All items moved to cart');
    }
  });

  store.syncCounts();
}

/* ----------  SHARED FOOTER  ---------- */
function renderFooter() {
  const year = new Date().getFullYear();
  /* Inline SVG helpers — zero external dependency, work on every page */
  const svgChevronUp   = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
  const svgFacebook    = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>';
  const svgInstagram   = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';
  const svgYoutube     = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.96 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>';
  const svgLinkedin    = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>';
  const svgMapPin      = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-top:4px;min-width:18px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const svgPhone       = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-top:4px;min-width:18px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.17a2 2 0 0 1 2-2.18H6.72a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  const svgEnvelope    = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-top:4px;min-width:18px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  const svgArrowRight  = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  const svgHeart       = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#e53e3e" stroke="none" aria-hidden="true" class="footer-heart-svg" style="vertical-align:middle"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  return `
  <footer class="footer">
    <button class="back-to-top" id="backToTop" title="Back to top">
      ${svgChevronUp}
    </button>

    <div class="footer-container">
      <div class="footer-top">

        <div class="footer-section company-info">
          <div class="footer-logo">
            <span class="logo-text">FAIR FORD Pharmaceuticals <br>PVT. LTD.</span>
          </div>
          <p class="company-description">At FAIRFORD Pharmaceuticals PVT. LTD. We are committed to delivering high-quality healthcare solutions that improve lives. With a focus on innovation and excellence, we strive to be a trusted partner in the pharmaceutical industry.</p>
          <div class="social-links">
            <a href="https://www.facebook.com/profile.php?id=61550892159031" class="social-icon" title="Facebook" aria-label="Follow us on Facebook" target="_blank">
              ${svgFacebook}
            </a>
            <a href="https://www.instagram.com/fairfordpharma/?__pwa=1" class="social-icon" title="Instagram" aria-label="Follow us on Instagram" target="_blank">
              ${svgInstagram}
            </a>
            <a href="https://www.youtube.com/@user-jm4zy6du8f" class="social-icon" title="YouTube" aria-label="Follow us on YouTube" target="_blank">
              ${svgYoutube}
            </a>
            <a href="https://www.linkedin.com/company/fairfordpharma" class="social-icon" title="LinkedIn" aria-label="Connect with us on LinkedIn" target="_blank">
              ${svgLinkedin}
            </a>
          </div>
        </div>

        <div class="divider-vertical"></div>

        <div class="footer-section">
          <h3 class="footer-title">Quick Links</h3>
          <ul class="footer-links">
            <li><a href="index.html" class="link-item">Home</a></li>
            <li><a href="About.html" class="link-item">About Us</a></li>
            <li><a href="contactus.html" class="link-item">Contact</a></li>
          </ul>
        </div>

        <div class="divider-vertical"></div>

        <div class="footer-section">
          <h3 class="footer-title">Support</h3>
          <ul class="footer-links">
            <li><a href="#faq" class="link-item">FAQ</a></li>
            <li><a href="#help" class="link-item">Help Center</a></li>
            <li><a href="privacy&policy.html" class="link-item">Privacy Policy</a></li>
            <li><a href="T&C.html" class="link-item">Terms &amp; Conditions</a></li>
          </ul>
        </div>

        <div class="divider-vertical"></div>

        <div class="footer-section contact-info">
          <h3 class="footer-title">Contact Us</h3>
          <div class="contact-item">
            ${svgMapPin}
            <div>
              <p class="contact-label">Address</p>
              <p class="contact-value" style="text-transform:lowercase;">1st,2nd,3rd and 4th floors, Fair Ford Tower,Gali No-07, Main Road, Anangpur Village, Opposite Mount Kailash Factory, Faridabad- 121003 (Haryana)</p>
            </div>
          </div>
          <div class="contact-item">
            ${svgPhone}
            <div>
              <p class="contact-label">Phone</p>
              <a href="tel:8595939723" class="contact-value">8595939723</a>
            </div>
          </div>
          <div class="contact-item">
            ${svgEnvelope}
            <div>
              <p class="contact-label">Email</p>
              <a href="mailto:info@fairfordpharma.com" class="contact-value">info@fairfordpharma.com</a>
            </div>
          </div>
        </div>

      </div>

      <div class="divider-horizontal"></div>

      <div class="newsletter-section">
        <div class="newsletter-content">
          <h3 class="newsletter-title">Connect With Us</h3>
          <p class="newsletter-subtitle">Get the latest updates delivered to your inbox</p>
        </div>
        <form class="newsletter-form" id="newsletterForm" novalidate>
          <div class="input-group">
            <input type="email" class="newsletter-input" placeholder="your@gmail.com" required aria-label="Email address">
            <button type="submit" class="newsletter-btn">
              <span>submit</span>
              ${svgArrowRight}
            </button>
          </div>
          <p class="newsletter-message" id="newsletterMessage"></p>
        </form>
      </div>

      <div class="divider-horizontal"></div>

      <div class="footer-bottom">
        <div class="copyright">
          <p>&copy; ${year} FAIRFORD Pharmaceuticals PVT. LTD. All rights reserved.</p>
        </div>
        <div class="footer-credit">
          <p>Designed and Created by <a href="https://www.linkedin.com/in/himanshu-prajapati-469737327?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank">Himanshu</a>, <a href="https://www.linkedin.com/in/bhardwaj-tushar-147711309?utm_source=share_via&utm_content=profile&utm_medium=member_android" target="_blank">Tushar</a> and <a href="https://www.linkedin.com/company/fair-ford-pharmaceuticals/" target="_blank">Dilip</a> ${svgHeart} | Powered by Fair Ford Pharmaceuticals PVT. LTD.</p>
        </div>
      </div>
    </div>
  </footer>`;
}

/* ----------  FOOTER INITIALISER  ---------- */
function initFooter() {
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    window.addEventListener('scroll', function () {
      backToTopBtn.classList.toggle('show', window.pageYOffset > 300);
    }, { passive: true });
    backToTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const newsletterForm = document.getElementById('newsletterForm');
  if (!newsletterForm) return;
  const newsletterInput  = newsletterForm.querySelector('.newsletter-input');
  const newsletterMsg    = document.getElementById('newsletterMessage');
  const emailRegex       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showNewsletterMsg(text, type) {
    newsletterMsg.textContent = text;
    newsletterMsg.className = 'newsletter-message ' + type;
  }

  newsletterForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = newsletterInput.value.trim();
    newsletterMsg.textContent = '';
    newsletterMsg.className = 'newsletter-message';

    if (!email)               { showNewsletterMsg('Please enter your email address.', 'error'); newsletterInput.focus(); return; }
    if (!emailRegex.test(email)) { showNewsletterMsg('Please enter a valid email address.', 'error'); newsletterInput.focus(); return; }

    const btn = newsletterForm.querySelector('.newsletter-btn');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Subscribing…</span>';

    fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          showNewsletterMsg('✓ Successfully subscribed! Check your email for confirmation.', 'success');
          newsletterInput.value = '';
        } else {
          showNewsletterMsg(data.message || 'Subscription failed. Please try again.', 'error');
        }
      })
      .catch(function () {
        showNewsletterMsg('Network error. Please try again later.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.innerHTML = orig;
      });
  });

  newsletterInput && newsletterInput.addEventListener('focus', function () {
    this.parentElement.style.boxShadow = '0 0 0 3px rgba(15,76,129,0.15)';
  });
  newsletterInput && newsletterInput.addEventListener('blur', function () {
    this.parentElement.style.boxShadow = 'none';
  });
}

/* ----------  AUTO-INJECT LOGOUT MODAL  ----------
   Runs on every page that loads common.js (index.html + all static pages).
   Dashboard pages (admin, retailer, distributor-inventory) carry an explicit
   <script src="/frontend/js/logout-confirm.js"> tag instead.       */
(function () {
  if (document.querySelector('script[src*="logout-confirm"]')) return;
  var s = document.createElement('script');
  s.src = '/frontend/js/logout-confirm.js';
  document.head.appendChild(s);
}());
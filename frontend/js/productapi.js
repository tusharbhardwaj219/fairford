/* =====================================================================
   frontend/product-api.js — Modified Product Listing
   This replaces product.js to fetch data from backend API
   Integration guide for connecting frontend to backend
   ===================================================================== */

// IMPORTANT: Include this BEFORE other scripts in your HTML:
// <script src="api.js"></script>

document.addEventListener('DOMContentLoaded', function () {
  console.log('MediBridge Products Page Loaded');

  /* ---- Inject shared chrome ---- */
  document.getElementById('site-header').innerHTML = renderHeader('products');
  document.getElementById('site-footer').innerHTML = renderFooter();

  const CATEGORIES = [];
  const STOCK_OPTS = ["In Stock", "Low Stock", "Out of Stock"];
  const RATING_OPTS = [
    { v: 4, l: "4★ & Above" },
    { v: 3, l: "3★ & Above" },
    { v: 2, l: "2★ & Above" }
  ];

  let PRICE_FLOOR = 0;
  let PRICE_CEIL = 5000;
  let ALL_PRODUCTS = [];

  /* Active filter state */
  const state = {
    search: "",
    categories: [],
    brands: [],
    stock: [],
    rating: 0,
    min: PRICE_FLOOR,
    max: PRICE_CEIL,
    sort: "featured",
    page: 1,
    limit: 12
  };

  // Initialize page
  async function initializePage() {
    try {
      showSkeletons(12);

      // Fetch categories
      const categoriesResponse = await API.categoryAPI.getAllCategories(true);
      const categories = categoriesResponse.categories || [];
      
      // Build category filter
      document.getElementById('filter-category').innerHTML = categories
        .map(cat => checkboxRow('category', cat.categoryName, 0))
        .join('');

      // Fetch initial products
      await loadProducts();

      // Build brand filter
      const brands = [...new Set(ALL_PRODUCTS.map(p => p.brand))].sort();
      document.getElementById('filter-brand').innerHTML = brands
        .map(b => checkboxRow('brand', b, ALL_PRODUCTS.filter(p => p.brand === b).length))
        .join('');

      // Stock filter
      document.getElementById('filter-stock').innerHTML = STOCK_OPTS
        .map(s => checkboxRow('stock', s, ALL_PRODUCTS.filter(p => p.stockStatus === s).length))
        .join('');

      // Rating filter
      document.getElementById('filter-rating').innerHTML = RATING_OPTS
        .map(o => {
          const stars = [1, 2, 3, 4, 5]
            .map(i => `<span class="${i <= o.v ? '' : 'dim'}">★</span>`)
            .join('');
          return `<label class="check rate-row">
            <input type="radio" name="rating" value="${o.v}" />
            <span class="box">${ICONS.check}</span>
            <span class="star-line">${stars}</span>
            <span class="tally">&amp; above</span>
          </label>`;
        })
        .join('');

      // Setup price range
      setupPriceRange();

      // Attach event listeners
      attachEventListeners();

    } catch (error) {
      console.error('Failed to initialize page:', error);
      grid.innerHTML = `<div class="empty-state">
        <p>Failed to load products. Please refresh the page.</p>
      </div>`;
    }
  }

  // Load products from API
  async function loadProducts() {
    try {
      const response = await API.productAPI.getAllProducts({
        page: state.page,
        limit: state.limit
      });

      ALL_PRODUCTS = response.products || [];

      // Update price range
      if (ALL_PRODUCTS.length > 0) {
        PRICE_FLOOR = Math.floor(Math.min(...ALL_PRODUCTS.map(p => p.retailerPrice)));
        PRICE_CEIL = Math.ceil(Math.max(...ALL_PRODUCTS.map(p => p.retailerPrice)));
        state.min = PRICE_FLOOR;
        state.max = PRICE_CEIL;
      }

      return response;
    } catch (error) {
      console.error('Error loading products:', error);
      ALL_PRODUCTS = [];
      throw error;
    }
  }

  // Helper function for checkbox rows
  function checkboxRow(name, value, tally) {
    return `<label class="check">
      <input type="checkbox" name="${name}" value="${value}" />
      <span class="box">${ICONS.check}</span>
      <span>${value}</span>
      ${tally != null ? `<span class="tally">${tally}</span>` : ''}
    </label>`;
  }

  // Price range setup
  function setupPriceRange() {
    const $min = document.getElementById('price-min');
    const $max = document.getElementById('price-max');
    const $lo = document.getElementById('range-lo');
    const $hi = document.getElementById('range-hi');
    const $fill = document.getElementById('range-fill');
    const $outLo = document.getElementById('out-lo');
    const $outHi = document.getElementById('out-hi');

    [$lo, $hi].forEach(r => {
      r.min = PRICE_FLOOR;
      r.max = PRICE_CEIL;
    });

    $lo.value = PRICE_FLOOR;
    $hi.value = PRICE_CEIL;
    $min.value = PRICE_FLOOR;
    $max.value = PRICE_CEIL;

    function paintRange() {
      const lo = Number($lo.value);
      const hi = Number($hi.value);
      const span = PRICE_CEIL - PRICE_FLOOR || 1;
      const lPct = ((lo - PRICE_FLOOR) / span) * 100;
      const hPct = ((hi - PRICE_FLOOR) / span) * 100;
      $fill.style.left = lPct + '%';
      $fill.style.width = (hPct - lPct) + '%';
      $outLo.textContent = inr(lo).replace('.00', '');
      $outHi.textContent = inr(hi).replace('.00', '');
    }

    paintRange();

    function rangeChanged() {
      let lo = Number($lo.value);
      let hi = Number($hi.value);
      if (lo > hi) {
        const t = lo;
        lo = hi;
        hi = t;
      }
      state.min = lo;
      state.max = hi;
      $min.value = lo;
      $max.value = hi;
      paintRange();
      applyLive();
    }

    $lo.addEventListener('input', () => {
      if (Number($lo.value) > Number($hi.value)) $lo.value = $hi.value;
      rangeChanged();
    });

    $hi.addEventListener('input', () => {
      if (Number($hi.value) < Number($lo.value)) $hi.value = $lo.value;
      rangeChanged();
    });

    $min.addEventListener('change', () => {
      let v = Math.max(PRICE_FLOOR, Math.min(Number($min.value) || PRICE_FLOOR, Number($max.value)));
      $min.value = v;
      $lo.value = v;
      state.min = v;
      paintRange();
      applyLive();
    });

    $max.addEventListener('change', () => {
      let v = Math.min(PRICE_CEIL, Math.max(Number($max.value) || PRICE_CEIL, Number($min.value)));
      $max.value = v;
      $hi.value = v;
      state.max = v;
      paintRange();
      applyLive();
    });
  }

  // Read filter state
  function readState() {
    state.search = (document.getElementById('search-input').value || '').trim().toLowerCase();
    state.categories = getChecked('category');
    state.brands = getChecked('brand');
    state.stock = getChecked('stock');
    const r = document.querySelector('input[name="rating"]:checked');
    state.rating = r ? Number(r.value) : 0;
    state.sort = document.getElementById('sort-select').value;
  }

  function getChecked(name) {
    return Array.prototype.slice
      .call(document.querySelectorAll('input[name="' + name + '"]:checked'))
      .map(el => el.value);
  }

  // Build filters object for API
  function buildAPIFilters() {
    const filters = {
      page: state.page,
      limit: state.limit,
      minPrice: state.min,
      maxPrice: state.max
    };

    if (state.search) filters.keyword = state.search;
    if (state.categories.length === 1) filters.category = state.categories[0];
    if (state.brands.length > 0) filters.brand = state.brands.join(',');
    if (state.stock.length > 0) filters.stockStatus = state.stock.join(',');
    if (state.rating > 0) filters.minRating = state.rating;
    if (state.sort !== 'featured') filters.sort = state.sort;

    return filters;
  }

  // Apply filters live
  let liveTimer;
  async function applyLive() {
    readState();
    renderChips();

    try {
      showSkeletons(12);
      const filters = buildAPIFilters();
      const response = await API.productAPI.getAllProducts(filters);
      const products = response.products || [];
      renderGrid(products, response.pagination);
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  }

  function debouncedLive() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(applyLive, 300);
  }

  // Attach event listeners
  function attachEventListeners() {
    document.getElementById('search-input').addEventListener('input', debouncedLive);
    document.getElementById('sort-select').addEventListener('change', applyLive);

    ['filter-category', 'filter-brand', 'filter-stock', 'filter-rating'].forEach(id => {
      document.getElementById(id).addEventListener('change', applyLive);
    });

    document.getElementById('apply-filters').addEventListener('click', () => {
      applyLive();
      toast('Filters applied');
      closeSidebar();
    });

    document.getElementById('clear-filters').addEventListener('click', () => {
      document.getElementById('search-input').value = '';
      Array.prototype.forEach.call(document.querySelectorAll('.filter-scroll input'), el => {
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      });
      state.min = PRICE_FLOOR;
      state.max = PRICE_CEIL;
      document.getElementById('sort-select').value = 'featured';
      applyLive();
      toast('Filters cleared');
    });

    document.getElementById('reset-top').addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('clear-filters').click();
    });

    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('filter-backdrop');

    function openSidebar() {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    }

    const openBtn = document.getElementById('open-filters');
    if (openBtn) openBtn.addEventListener('click', openSidebar);
    backdrop.addEventListener('click', closeSidebar);
  }

  // Render products grid
  const grid = document.getElementById('product-grid');

  function cardHTML(p) {
    const save = Math.round(((p.mrp - p.retailerPrice) / p.mrp) * 100);
    const out = p.stockStatus === "Out of Stock";
    const wished = store.wishlist.indexOf(p._id) >= 0;

    return `<article class="card" data-id="${p._id}">
      <button class="wish ${wished ? 'active' : ''}" data-wish="${p._id}" aria-label="Add to wishlist">${ICONS.heart}</button>
      <div class="card-media" data-go="${p._id}">
        <div class="pv"><span class="cat-tag">${p.categoryName}</span>${productImageSVG(p.categoryName)}</div>
      </div>
      <div class="card-body">
        <div class="card-top">
          <span class="brandline">${p.brand}</span>
          <span class="badge ${badgeClass(p.stockStatus)}">${p.stockStatus}</span>
        </div>
        <h3 class="pname" data-go="${p._id}">${p.name}</h3>
        <div class="meta-row">
          <span>${p.packSize}</span><span class="dot"></span><span>${p.strength}</span>
        </div>
        <div class="rating-row">${renderStars(p.rating)} <b>${p.rating}</b> <span>(${p.reviewCount})</span></div>
        <div class="price-block">
          <span class="retail">${inr(p.retailerPrice).replace('.00', '')}</span>
          <span class="mrp">${inr(p.mrp).replace('.00', '')}</span>
          ${save > 0 ? `<span class="save">${save}% OFF</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" data-cart="${p._id}" ${out ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
            ${ICONS.cart} ${out ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button class="btn btn-ghost" data-go="${p._id}" aria-label="View details">${ICONS.eye}</button>
        </div>
      </div>
    </article>`;
  }

  function renderGrid(products, pagination) {
    const count = products.length;
    document.getElementById('result-count').textContent = pagination ? pagination.totalCount : count;

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state">
        ${ICONS.search}
        <h3>No products match your filters</h3>
        <p>Try widening your price range or clearing a few filters.</p>
      </div>`;
      return;
    }

    grid.innerHTML = products.map(cardHTML).join('');

    // Attach click handlers
    grid.addEventListener('click', function (e) {
      const go = e.target.closest('[data-go]');
      const cart = e.target.closest('[data-cart]');
      const wish = e.target.closest('[data-wish]');

      if (wish) {
        const on = store.toggleWish(wish.getAttribute('data-wish'));
        wish.classList.toggle('active', on);
        store.syncCounts();
        toast(on ? 'Added to wishlist' : 'Removed from wishlist');
        return;
      }

      if (cart && !cart.disabled) {
        store.addToCart(cart.getAttribute('data-cart'), 1);
        store.syncCounts();
        toast('Added to cart');
        return;
      }

      if (go) {
        window.location.href = 'productdetail.html?id=' + go.getAttribute('data-go');
      }
    });

    // Stagger animation
    Array.from(grid.querySelectorAll('.card')).forEach((c, i) => {
      c.style.animationDelay = Math.min(i * 45, 400) + 'ms';
    });
  }

  function renderChips() {
    const chips = [];

    if (state.search) {
      chips.push({
        t: '"' + state.search + '"',
        clear: () => {
          document.getElementById('search-input').value = '';
        }
      });
    }

    state.categories.forEach(c => {
      chips.push({
        t: c,
        clear: () => uncheck('category', c)
      });
    });

    state.brands.forEach(b => {
      chips.push({
        t: b,
        clear: () => uncheck('brand', b)
      });
    });

    state.stock.forEach(s => {
      chips.push({
        t: s,
        clear: () => uncheck('stock', s)
      });
    });

    if (state.rating) {
      chips.push({
        t: state.rating + '★ & above',
        clear: () => {
          const r = document.querySelector('input[name="rating"]:checked');
          if (r) r.checked = false;
        }
      });
    }

    if (state.min > PRICE_FLOOR || state.max < PRICE_CEIL) {
      chips.push({
        t: inr(state.min).replace('.00', '') + ' – ' + inr(state.max).replace('.00', ''),
        clear: () => {
          document.getElementById('price-min').value = PRICE_FLOOR;
          document.getElementById('price-max').value = PRICE_CEIL;
          state.min = PRICE_FLOOR;
          state.max = PRICE_CEIL;
        }
      });
    }

    const box = document.getElementById('active-chips');
    if (!chips.length) {
      box.innerHTML = '';
      return;
    }

    box.innerHTML = '';
    chips.forEach(c => {
      const el = document.createElement('span');
      el.className = 'chip';
      el.innerHTML = c.t + '<button aria-label="Remove">' + ICONS.x + '</button>';
      el.querySelector('button').addEventListener('click', () => {
        c.clear();
        applyLive();
      });
      box.appendChild(el);
    });
  }

  function uncheck(name, value) {
    const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = false;
  }

  function showSkeletons(n) {
    let html = '';
    for (let i = 0; i < n; i++) {
      html += `<div class="skeleton-card">
        <div class="sk sk-media"></div>
        <div class="sk sk-line w40"></div>
        <div class="sk sk-line w80"></div>
        <div class="sk sk-line w60"></div>
        <div class="sk sk-btn"></div>
      </div>`;
    }
    grid.innerHTML = html;
  }

  // Initialize everything
  initializePage();
  store.syncCounts();
});
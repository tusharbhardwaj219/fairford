/* ============================================================
   FAIR FORD PHARMACEUTICALS — PHASE 1
   Module logic: Store, Search, Cart, Wishlist, Toasts.
   No framework dependencies. State persisted in localStorage.
   ============================================================ */

/* ============================================================
   1. PRODUCT DATA  (demo — replace with API/DB later)
   ============================================================ */
const PRODUCTS = [
  { id:'p01', name:'Paracetamol 500mg', composition:'Paracetamol IP 500mg', mfr:'Cipla', pack:'Strip of 10 tabs', mrp:15.50, net:9.30, moq:50, scheme:'10+1', schedule:'H', hsn:'30049099', cat:'analgesic' },
  { id:'p02', name:'Azithromycin 500mg', composition:'Azithromycin IP 500mg', mfr:'Sun Pharma', pack:'Strip of 3 tabs', mrp:120.00, net:78.00, moq:20, scheme:'5+1', schedule:'H', hsn:'30042039', cat:'antibiotic' },
  { id:'p03', name:'Pantoprazole 40mg', composition:'Pantoprazole Sodium 40mg', mfr:"Dr Reddy's", pack:'Strip of 15 tabs', mrp:85.00, net:52.00, moq:30, scheme:'10+2', schedule:'H1', hsn:'30049094', cat:'gastric' },
  { id:'p04', name:'Cetirizine 10mg', composition:'Cetirizine HCl IP 10mg', mfr:'Mankind Pharma', pack:'Strip of 10 tabs', mrp:22.00, net:13.00, moq:100, scheme:'10+1', schedule:'H', hsn:'30049099', cat:'analgesic' },
  { id:'p05', name:'Amoxicillin 500mg', composition:'Amoxicillin Trihydrate 500mg', mfr:'Alkem Labs', pack:'Strip of 10 caps', mrp:95.00, net:60.00, moq:25, scheme:'5+1', schedule:'H', hsn:'30041020', cat:'antibiotic' },
  { id:'p06', name:'Metformin 500mg SR', composition:'Metformin HCl 500mg SR', mfr:'Lupin', pack:'Strip of 15 tabs', mrp:35.00, net:21.00, moq:50, scheme:'10+1', schedule:'H', hsn:'30049095', cat:'diabetes' },
  { id:'p07', name:'Vitamin D3 60K', composition:'Cholecalciferol 60,000 IU', mfr:'Glenmark', pack:'Pack of 4 sachets', mrp:180.00, net:115.00, moq:20, scheme:'10+2', schedule:'OTC', hsn:'30045090', cat:'vitamin' },
  { id:'p08', name:'Atorvastatin 10mg', composition:'Atorvastatin Calcium 10mg', mfr:'Torrent Pharma', pack:'Strip of 10 tabs', mrp:78.00, net:47.00, moq:30, scheme:'10+1', schedule:'H', hsn:'30049099', cat:'cardiac' },
  { id:'p09', name:'Telmisartan 40mg', composition:'Telmisartan IP 40mg', mfr:'Macleods', pack:'Strip of 10 tabs', mrp:65.00, net:39.00, moq:30, scheme:'10+1', schedule:'H', hsn:'30049099', cat:'cardiac' },
  { id:'p10', name:'Omeprazole 20mg', composition:'Omeprazole 20mg + Domperidone 10mg', mfr:'Zydus', pack:'Strip of 10 caps', mrp:42.00, net:25.00, moq:40, scheme:'10+1', schedule:'H', hsn:'30049094', cat:'gastric' },
  { id:'p11', name:'Glimepiride 2mg', composition:'Glimepiride 2mg + Metformin 500mg', mfr:'USV', pack:'Strip of 10 tabs', mrp:88.00, net:54.00, moq:25, scheme:'5+1', schedule:'H', hsn:'30049095', cat:'diabetes' },
  { id:'p12', name:'Methylcobalamin 1500mcg', composition:'Mecobalamin 1500mcg + Folic Acid + B6', mfr:'Intas', pack:'Strip of 10 tabs', mrp:110.00, net:68.00, moq:30, scheme:'10+1', schedule:'OTC', hsn:'30045010', cat:'vitamin' }
];

const SCHEDULE_LABELS = { H:'Schedule H', H1:'Schedule H1', X:'Schedule X', OTC:'OTC' };
const GST_RATE = 0.12;

/* ============================================================
   2. STORE — single source of truth, persisted in localStorage
   ============================================================ */
const STORAGE_KEY = 'fairford.v1';
const Store = {
  state: { cart: {}, wishlist: [] },

  load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){ this.state = { cart:{}, wishlist:[], ...JSON.parse(raw) }; }
    }catch(e){ console.warn('Store load failed', e); }
  },
  save(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
    catch(e){ console.warn('Store save failed', e); }
  },

  /* Cart */
  cartAdd(id, qty=1){
    const cur = this.state.cart[id] || 0;
    this.state.cart[id] = cur + qty;
    this.save();
  },
  cartSet(id, qty){
    if(qty<=0){ delete this.state.cart[id]; }
    else{ this.state.cart[id] = qty; }
    this.save();
  },
  cartRemove(id){ delete this.state.cart[id]; this.save(); },
  cartCount(){ return Object.values(this.state.cart).reduce((s,n)=>s+n,0); },
  cartEntries(){ return Object.entries(this.state.cart); },
  cartHas(id){ return !!this.state.cart[id]; },

  /* Wishlist */
  wishToggle(id){
    const i = this.state.wishlist.indexOf(id);
    if(i>=0) this.state.wishlist.splice(i,1);
    else this.state.wishlist.push(id);
    this.save();
    return i<0; // true if newly added
  },
  wishRemove(id){
    const i = this.state.wishlist.indexOf(id);
    if(i>=0){ this.state.wishlist.splice(i,1); this.save(); }
  },
  wishHas(id){ return this.state.wishlist.includes(id); },
  wishCount(){ return this.state.wishlist.length; }
};
Store.load();

/* ============================================================
   3. DOM HELPERS
   ============================================================ */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => [...c.querySelectorAll(s)];
const productById = id => PRODUCTS.find(p => p.id === id);
const inr = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const firstLetters = name => name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const escapeHtml = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ============================================================
   4. TOAST
   ============================================================ */
function toast(msg, kind='success'){
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const icon = kind==='warn'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  el.innerHTML = icon + '<span>' + escapeHtml(msg) + '</span>';
  $('#toastStack').appendChild(el);
  setTimeout(()=>el.remove(), 2800);
}

/* ============================================================
   5. COUNTERS (header badges + sidebar counts)
   ============================================================ */
function refreshCounters(pulse=null){
  const cartC = Store.cartCount();
  const wishC = Store.wishCount();
  const cb = $('#cartCount'); const wb = $('#wishlistCount');
  cb.textContent = cartC; cb.classList.toggle('empty', cartC===0);
  wb.textContent = wishC; wb.classList.toggle('empty', wishC===0);
  $('#cartSideCount').textContent = cartC + ' item' + (cartC===1?'':'s');
  $('#wishSideCount').textContent = wishC + ' item' + (wishC===1?'':'s');
  if(pulse==='cart'){ cb.classList.add('pulse'); setTimeout(()=>cb.classList.remove('pulse'),200); }
  if(pulse==='wish'){ wb.classList.add('pulse'); setTimeout(()=>wb.classList.remove('pulse'),200); }
}

/* ============================================================
   6. PRODUCT GRID
   ============================================================ */
let currentCat = 'all';

function renderGrid(filter='all'){
  const grid = $('#productGrid');
  const list = filter==='all' ? PRODUCTS : PRODUCTS.filter(p=>p.cat===filter);
  grid.innerHTML = list.map(p => productCardHtml(p)).join('');
}

function productCardHtml(p){
  const fav = Store.wishHas(p.id);
  const inCart = Store.cartHas(p.id);
  return `
  <article class="card" data-id="${p.id}">
    <div class="card-head">
      <span class="card-schedule sch-${p.schedule}">${SCHEDULE_LABELS[p.schedule] || p.schedule}</span>
      <button class="btn-fav ${fav?'is-active':''}" data-fav="${p.id}" aria-label="Wishlist toggle">
        <svg viewBox="0 0 24 24" fill="${fav?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
    </div>
    <div>
      <h3 class="card-name">${escapeHtml(p.name)}</h3>
      <p class="card-composition">${escapeHtml(p.composition)}</p>
    </div>
    <div class="card-meta">
      <span><b>${escapeHtml(p.mfr)}</b></span>
      <span>${escapeHtml(p.pack)}</span>
      <span>HSN <b>${p.hsn}</b></span>
    </div>
    <div class="card-pricing">
      <div>
        <div class="price-mrp">MRP ${inr(p.mrp)}</div>
        <div><span class="price-net">${inr(p.net)}</span><span class="price-unit">/ unit</span></div>
      </div>
      <span class="scheme-tag">${p.scheme}</span>
    </div>
    <div class="moq-line">MOQ: <b>${p.moq}</b> units · Margin <b>${Math.round((p.mrp-p.net)/p.mrp*100)}%</b></div>
    <button class="btn-add ${inCart?'in-cart':''}" data-add="${p.id}">
      ${inCart
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Added to Cart'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Add to Cart'}
    </button>
  </article>`;
}

/* ============================================================
   7. SEARCH
   ============================================================ */
const searchTrigger = $('#searchTrigger');
const searchPopup   = $('#searchPopup');
const searchInput   = $('#searchInput');
const searchResults = $('#searchResults');
const overlay       = $('#overlay');

function openSearch(){
  searchPopup.classList.add('is-open');
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  setTimeout(()=>searchInput.focus(), 50);
  renderSearchResults('');
}
function closeSearch(){
  searchPopup.classList.remove('is-open');
  if(!anySidebarOpen()){
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  searchInput.value = '';
}
function anySidebarOpen(){
  return $('#cartSidebar').classList.contains('is-open') || $('#wishSidebar').classList.contains('is-open');
}

function matchScore(p, q){
  if(!q) return 0;
  const hay = (p.name + ' ' + p.composition + ' ' + p.mfr + ' ' + p.hsn + ' ' + SCHEDULE_LABELS[p.schedule] + ' ' + p.cat).toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for(const t of terms){
    if(!hay.includes(t)) return 0;
    if(p.name.toLowerCase().startsWith(t)) score += 10;
    if(p.name.toLowerCase().includes(t))   score += 5;
    if(p.mfr.toLowerCase().includes(t))    score += 3;
    if(p.composition.toLowerCase().includes(t)) score += 2;
    score += 1;
  }
  return score;
}
function highlight(text, q){
  if(!q) return escapeHtml(text);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let out = escapeHtml(text);
  for(const t of terms){
    const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}
function renderSearchResults(q){
  const ranked = PRODUCTS
    .map(p => ({ p, s: matchScore(p, q) }))
    .filter(x => q ? x.s > 0 : true)
    .sort((a,b) => b.s - a.s)
    .slice(0, 8);

  if(ranked.length === 0){
    searchResults.innerHTML = `
      <div class="search-empty">
        <div class="big">No matches for "${escapeHtml(q)}"</div>
        <div>Try a brand, molecule, manufacturer, or HSN code.</div>
      </div>`;
    return;
  }

  const head = q
    ? `<div class="search-section-title">${ranked.length} result${ranked.length===1?'':'s'}</div>`
    : `<div class="search-section-title">Suggested for you</div>`;

  searchResults.innerHTML = head + ranked.map(({p}) => `
    <div class="s-result" data-go="${p.id}" tabindex="0">
      <div class="s-result-thumb">${firstLetters(p.name)}</div>
      <div class="s-result-body">
        <p class="s-result-name">${highlight(p.name, q)}</p>
        <p class="s-result-meta">${highlight(p.composition + ' · ' + p.mfr + ' · HSN ' + p.hsn, q)}</p>
      </div>
      <div class="s-result-price">${inr(p.net)}</div>
    </div>
  `).join('');
}

searchTrigger.addEventListener('click', openSearch);
$('.search-close', searchPopup).addEventListener('click', closeSearch);
searchInput.addEventListener('input', e => renderSearchResults(e.target.value.trim()));
$$('.s-chip').forEach(c => c.addEventListener('click', () => {
  searchInput.value = c.dataset.q;
  renderSearchResults(c.dataset.q);
  searchInput.focus();
}));
searchResults.addEventListener('click', e => {
  const row = e.target.closest('[data-go]');
  if(!row) return;
  const p = productById(row.dataset.go);
  closeSearch();
  openProductModal(p);
});

/* Keyboard shortcuts */
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    if(searchPopup.classList.contains('is-open')) closeSearch(); else openSearch();
  }
  if(e.key === 'Escape'){
    if(searchPopup.classList.contains('is-open')) closeSearch();
    if($('#cartSidebar').classList.contains('is-open')) closeSidebar('cart');
    if($('#wishSidebar').classList.contains('is-open')) closeSidebar('wish');
    if($('#prodModalWrap').classList.contains('is-open')) closeProductModal();
  }
});

/* ============================================================
   8. SIDEBARS
   ============================================================ */
function openSidebar(which){
  $('#' + (which==='cart'?'cartSidebar':'wishSidebar')).classList.add('is-open');
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if(which==='cart') renderCart(); else renderWishlist();
}

function closeSidebar(which){
  $('#' + (which==='cart'?'cartSidebar':'wishSidebar')).classList.remove('is-open');
  if(!anySidebarOpen() && !searchPopup.classList.contains('is-open')){
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }
}

$('#cartBtn').addEventListener('click', () => openSidebar('cart'));
$('#wishlistBtn').addEventListener('click', () => openSidebar('wish'));
$$('.sidebar-close').forEach(b => {
  if(!b.dataset.close) return;
  b.addEventListener('click', () => closeSidebar(b.dataset.close));
});
overlay.addEventListener('click', () => {
  closeSearch();
  closeSidebar('cart');
  closeSidebar('wish');
});

/* ============================================================
   9. CART RENDER + MATH
   ============================================================ */
function renderCart(){
  const body = $('#cartBody');
  const foot = $('#cartFoot');
  const entries = Store.cartEntries();

  if(entries.length === 0){
    body.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <div class="big">Your cart is empty</div>
        <div>Browse the catalogue and add formulations.</div>
      </div>`;
    foot.style.display = 'none';
    return;
  }

  let subtotal = 0;
  let moqViolations = 0;

  body.innerHTML = entries.map(([id, qty]) => {
    const p = productById(id); if(!p) return '';
    const lineTotal = p.net * qty;
    subtotal += lineTotal;
    const underMoq = qty < p.moq;
    if(underMoq) moqViolations++;

    // Scheme bonus parse: "10+1" → for every 10 paid, 1 free
    const [paid, free] = p.scheme.split('+').map(Number);
    const bonusUnits = paid && free ? Math.floor(qty / paid) * free : 0;

    return `
    <div class="line" data-line="${p.id}">
      <div class="line-thumb">${firstLetters(p.name)}</div>
      <div>
        <p class="line-name">${escapeHtml(p.name)}</p>
        <p class="line-comp">${escapeHtml(p.mfr)} · ${escapeHtml(p.pack)}</p>
        <p class="line-rate">Net <b>${inr(p.net)}</b> · MOQ ${p.moq} · Scheme ${p.scheme}</p>
        <div class="qty">
          <button data-step="-1" data-id="${p.id}" aria-label="Decrease">−</button>
          <input type="number" min="1" value="${qty}" data-qty="${p.id}">
          <button data-step="1" data-id="${p.id}" aria-label="Increase">+</button>
        </div>
      </div>
      <div class="line-right">
        <span class="line-total">${inr(lineTotal)}</span>
        <button class="line-remove" data-remove="${p.id}">Remove</button>
      </div>
      ${bonusUnits > 0 ? `<div class="line-scheme-info">+ ${bonusUnits} free unit${bonusUnits===1?'':'s'} (scheme ${p.scheme})</div>` : ''}
      ${underMoq ? `<div class="line-moq-warn">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
        Below MOQ — add ${p.moq - qty} more unit${p.moq-qty===1?'':'s'} to place order
      </div>` : ''}
    </div>`;
  }).join('');

  const gst = subtotal * GST_RATE;
  const total = subtotal + gst;

  foot.style.display = 'block';
  foot.innerHTML = `
    <div class="totals">
      <div class="totals-row"><span>Subtotal (${entries.length} SKU${entries.length===1?'':'s'})</span><b>${inr(subtotal)}</b></div>
      <div class="totals-row"><span>GST (12%, estimate)</span><b>${inr(gst)}</b></div>
      <div class="totals-row grand"><span>Order Total</span><b>${inr(total)}</b></div>
    </div>
    <button class="btn-checkout" ${moqViolations>0?'disabled':''}>
      ${moqViolations>0 ? `Resolve ${moqViolations} MOQ issue${moqViolations===1?'':'s'}` : 'Proceed to Checkout'}
    </button>
    <p class="foot-note">GST invoice with HSN codes generated on confirmation. Final tax may vary by destination state.</p>`;
}

$('#cartBody').addEventListener('click', e => {
  const step = e.target.closest('[data-step]');
  const rem  = e.target.closest('[data-remove]');
  if(step){
    const id = step.dataset.id;
    const cur = Store.state.cart[id] || 0;
    Store.cartSet(id, Math.max(1, cur + Number(step.dataset.step)));
    refreshCounters(); renderCart(); renderGrid(currentCat);
  } else if(rem){
    Store.cartRemove(rem.dataset.remove);
    refreshCounters(); renderCart(); renderGrid(currentCat);
    toast('Removed from cart');
  }
});
$('#cartBody').addEventListener('change', e => {
  const inp = e.target.closest('[data-qty]');
  if(!inp) return;
  const v = Math.max(1, parseInt(inp.value, 10) || 1);
  Store.cartSet(inp.dataset.qty, v);
  refreshCounters(); renderCart(); renderGrid(currentCat);
});

/* ============================================================
   10. WISHLIST RENDER
   ============================================================ */
function renderWishlist(){
  const body = $('#wishBody');
  const ids = Store.state.wishlist;

  if(ids.length === 0){
    body.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <div class="big">No saved products</div>
        <div>Tap the heart on any card to save it for later.</div>
      </div>`;
    return;
  }

  body.innerHTML = ids.map(id => {
    const p = productById(id); if(!p) return '';
    return `
    <div class="wish-line">
      <div class="line-thumb">${firstLetters(p.name)}</div>
      <div>
        <p class="line-name">${escapeHtml(p.name)}</p>
        <p class="line-comp">${escapeHtml(p.mfr)} · ${escapeHtml(p.pack)}</p>
        <p class="line-rate">Net <b>${inr(p.net)}</b> · MOQ ${p.moq}</p>
      </div>
      <div class="wish-actions">
        <button class="wish-move" data-wmove="${p.id}">MOVE TO CART</button>
        <button class="wish-remove" data-wremove="${p.id}">Remove</button>
      </div>
    </div>`;
  }).join('');
}

$('#wishBody').addEventListener('click', e => {
  const m = e.target.closest('[data-wmove]');
  const r = e.target.closest('[data-wremove]');
  if(m){
    const p = productById(m.dataset.wmove);
    Store.cartAdd(p.id, p.moq);
    Store.wishRemove(p.id);
    refreshCounters('cart'); renderWishlist(); renderCart(); renderGrid(currentCat);
    toast('Moved to cart at MOQ (' + p.moq + ' units)');
  } else if(r){
    Store.wishRemove(r.dataset.wremove);
    refreshCounters(); renderWishlist(); renderGrid(currentCat);
    toast('Removed from wishlist');
  }
});

/* ============================================================
   11. GRID INTERACTIONS (add + favourite)
   ============================================================ */
$('#productGrid').addEventListener('click', e => {
  const addBtn = e.target.closest('[data-add]');
  const favBtn = e.target.closest('[data-fav]');
  if(addBtn){
    const p = productById(addBtn.dataset.add);
    if(Store.cartHas(p.id)){
      openSidebar('cart');
      return;
    }
    Store.cartAdd(p.id, p.moq);
    refreshCounters('cart');
    renderGrid(currentCat);
    renderCart();
    toast('Added ' + p.name + ' × ' + p.moq + ' to cart');
  } else if(favBtn){
    const p = productById(favBtn.dataset.fav);
    const added = Store.wishToggle(p.id);
    refreshCounters('wish');
    renderGrid(currentCat);
    renderWishlist();
    toast(added ? 'Saved to wishlist' : 'Removed from wishlist');
  }
});

/* Category pill filters */
$$('.pill').forEach(pill => pill.addEventListener('click', () => {
  $$('.pill').forEach(p => p.classList.remove('is-active'));
  pill.classList.add('is-active');
  currentCat = pill.dataset.cat;
  renderGrid(currentCat);
}));

/* ============================================================
   12. PRODUCT DETAIL MODAL
   ============================================================ */
function openProductModal(p){
  const fav = Store.wishHas(p.id);
  const inCart = Store.cartHas(p.id);
  const [paid, free] = p.scheme.split('+').map(Number);
  const bonusUnits = paid && free ? Math.floor(p.moq / paid) * free : 0;

  $('#prodModalBody').innerHTML = `
    <div class="pmd-top">
      <div class="pmd-thumb">${firstLetters(p.name)}</div>
      <div class="pmd-info">
        <span class="card-schedule sch-${p.schedule}">${SCHEDULE_LABELS[p.schedule] || p.schedule}</span>
        <h2 class="pmd-name">${escapeHtml(p.name)}</h2>
        <p class="pmd-comp">${escapeHtml(p.composition)}</p>
      </div>
    </div>
    <div class="pmd-details">
      <div class="pmd-row"><span>Manufacturer</span><b>${escapeHtml(p.mfr)}</b></div>
      <div class="pmd-row"><span>Pack</span><b>${escapeHtml(p.pack)}</b></div>
      <div class="pmd-row"><span>HSN Code</span><b>${p.hsn}</b></div>
      <div class="pmd-row"><span>MOQ</span><b>${p.moq} units</b></div>
      <div class="pmd-row"><span>Scheme</span><b>${p.scheme}${bonusUnits ? ' (+ ' + bonusUnits + ' free at MOQ)' : ''}</b></div>
      <div class="pmd-row"><span>MRP</span><b>${inr(p.mrp)}</b></div>
      <div class="pmd-row pmd-row-net"><span>Net Rate</span><b>${inr(p.net)} / unit</b></div>
      <div class="pmd-row"><span>Margin</span><b>${Math.round((p.mrp - p.net) / p.mrp * 100)}%</b></div>
    </div>
    <div class="pmd-actions">
      <button class="btn-fav pmd-wish ${fav?'is-active':''}" data-modal-fav="${p.id}" aria-label="Wishlist">
        <svg viewBox="0 0 24 24" fill="${fav?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        ${fav ? 'Saved' : 'Wishlist'}
      </button>
      <button class="btn-add pmd-add ${inCart?'in-cart':''}" data-modal-add="${p.id}">
        ${inCart
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> View Cart'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Add to Cart (MOQ ' + p.moq + ')'}
      </button>
    </div>`;

  $('#prodModalWrap').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal(){
  $('#prodModalWrap').classList.remove('is-open');
  if(!anySidebarOpen() && !searchPopup.classList.contains('is-open')){
    document.body.style.overflow = '';
  }
}

$('#prodModal').addEventListener('click', e => {
  const addBtn = e.target.closest('[data-modal-add]');
  const favBtn = e.target.closest('[data-modal-fav]');
  if(addBtn){
    const p = productById(addBtn.dataset.modalAdd);
    if(Store.cartHas(p.id)){
      closeProductModal();
      openSidebar('cart');
      return;
    }
    Store.cartAdd(p.id, p.moq);
    refreshCounters('cart');
    renderGrid(currentCat);
    renderCart();
    addBtn.className = 'btn-add pmd-add in-cart';
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> View Cart';
    toast('Added ' + p.name + ' × ' + p.moq + ' to cart');
  } else if(favBtn){
    const p = productById(favBtn.dataset.modalFav);
    const added = Store.wishToggle(p.id);
    refreshCounters('wish');
    renderGrid(currentCat);
    renderWishlist();
    favBtn.className = 'btn-fav pmd-wish' + (added ? ' is-active' : '');
    favBtn.querySelector('svg').setAttribute('fill', added ? 'currentColor' : 'none');
    favBtn.lastChild.textContent = ' ' + (added ? 'Saved' : 'Wishlist');
    toast(added ? 'Saved to wishlist' : 'Removed from wishlist');
  }
});

$('#prodModalClose').addEventListener('click', closeProductModal);
$('#prodModalWrap').addEventListener('click', e => {
  if(e.target === $('#prodModalWrap')) closeProductModal();
});

/* ============================================================
   13. BOOT
   ============================================================ */
renderGrid('all');
renderCart();
renderWishlist();
refreshCounters();
/* =========================================
   FAIR FORD PHARMACEUTICALS - CONTACT PAGE
   OPTIMIZED JavaScript v2.0
   ========================================= */

'use strict';

// ==================== AUTH STATE ====================
(function initAuthState() {
    var loginNavBtn     = document.getElementById('loginNavBtn');
    var logoutNavBtn    = document.getElementById('logoutNavBtn');
    var drawerLoginBtn  = document.getElementById('drawerLoginBtn');
    var drawerLogoutBtn = document.getElementById('drawerLogoutBtn');

    function updateAuthUI() {
        var isLoggedIn = !!localStorage.getItem('ff_user');
        if (loginNavBtn)     loginNavBtn.style.display     = isLoggedIn ? 'none' : '';
        if (logoutNavBtn)    logoutNavBtn.style.display    = isLoggedIn ? ''     : 'none';
        if (drawerLoginBtn)  drawerLoginBtn.style.display  = isLoggedIn ? 'none' : '';
        if (drawerLogoutBtn) drawerLogoutBtn.style.display = isLoggedIn ? ''     : 'none';
    }

    function logout() {
        localStorage.removeItem('ff_user');
        localStorage.removeItem('ff_token');
        updateAuthUI();
    }

    if (logoutNavBtn)    logoutNavBtn.addEventListener('click', logout);
    if (drawerLogoutBtn) drawerLogoutBtn.addEventListener('click', logout);

    // Products links: redirect to login if not logged in
    ['productsNavLink', 'productsDrawerLink'].forEach(function(id) {
        var link = document.getElementById(id);
        if (link) {
            link.addEventListener('click', function(e) {
                if (!localStorage.getItem('ff_user')) {
                    e.preventDefault();
                    window.location.href = 'login&signup.html';
                }
            });
        }
    });

    updateAuthUI();
})();

// ===========================
// CONFIG & CONSTANTS
// ===========================

const CONFIG = {
    SCROLL_THRESHOLD: 300,
    THROTTLE_DELAY: 100,
    MIN_MESSAGE_LENGTH: 10,
    MAX_MESSAGE_LENGTH: 500,
    FORM_SUBMIT_DELAY: 2000,
    MESSAGE_HIDE_DELAY: 10000,
    ERROR_HIDE_DELAY: 8000
};

// ===========================
// CACHED SELECTORS
// ===========================

const elements = {};

function cacheSelectors() {
    elements.form = document.getElementById('contactForm');
    elements.header = document.getElementById('siteHeader');
    elements.backToTop = document.getElementById('backToTop');
    elements.hamburger = document.getElementById('hamburgerBtn');
    elements.drawer = document.getElementById('mobileDrawer');
    elements.drawerOverlay = document.getElementById('drawerOverlay');
    elements.drawerClose = document.getElementById('drawerClose');
    elements.newsletterForm = document.getElementById('newsletterForm');
    elements.phoneInput = document.getElementById('phone');
    elements.messageTextarea = document.getElementById('message');
}

// ===========================
// UTILITIES
// ===========================

const debounce = (fn, delay = 20) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

const throttle = (fn, limit = 100) => {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

const qs = (selector, parent = document) => parent.querySelector(selector);
const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];

// ===========================
// FORM VALIDATION
// ===========================

const validators = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[0-9+\-\s()]{10,}$/
};

function validateField(field) {
    const errorEl = field.parentElement?.querySelector('.error-message');
    if (!errorEl) return true;
    
    const value = field.value.trim();
    let isValid = true;
    let message = '';

    // Remove previous error
    field.classList.remove('error');
    errorEl.classList.remove('show');

    // Required check
    if (field.required && !value) {
        isValid = false;
        message = 'This field is required';
    }
    // Email validation
    else if (field.type === 'email' && value && !validators.email.test(value)) {
        isValid = false;
        message = 'Please enter a valid email address';
    }
    // Phone validation
    else if (field.type === 'tel' && value && !validators.phone.test(value)) {
        isValid = false;
        message = 'Please enter a valid phone number';
    }
    // Textarea length validation
    else if (field.tagName === 'TEXTAREA' && value) {
        if (value.length < CONFIG.MIN_MESSAGE_LENGTH) {
            isValid = false;
            message = `Message must be at least ${CONFIG.MIN_MESSAGE_LENGTH} characters`;
        }
    }

    if (!isValid) {
        field.classList.add('error');
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }

    return isValid;
}

function validateForm(form) {
    const inputs = qsa('input[required], textarea[required]', form);
    return inputs.every(validateField);
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.currentTarget;
    const submitBtn = qs('.submit-btn', form);
    const successMsg = qs('.success-message', form);
    const errorMsg = qs('.error-message-box', form);

    successMsg?.classList.remove('show');
    errorMsg?.classList.remove('show');

    if (!validateForm(form)) {
        const firstError = qs('.error', form);
        firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstError?.focus();
        return;
    }

    submitBtn?.classList.add('loading');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const formData = new FormData(form);
        const payload = {
            name:        (formData.get('fullName') || '').trim(),
            email:       (formData.get('email') || '').trim(),
            phone:       (formData.get('phone') || '').replace(/\D/g, '').slice(-10),
            message:     (formData.get('message') || '').trim(),
            inquiryType: 'Business Inquiry',
        };

        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (res.ok && json.success) {
            form.reset();
            if (successMsg) {
                successMsg.classList.add('show');
                successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => successMsg.classList.remove('show'), CONFIG.MESSAGE_HIDE_DELAY);
            }
        } else {
            throw new Error(json.message || 'Submission failed');
        }
    } catch (error) {
        if (errorMsg) {
            errorMsg.classList.add('show');
            errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => errorMsg.classList.remove('show'), CONFIG.ERROR_HIDE_DELAY);
        }
        console.error('Form error:', error);
    } finally {
        submitBtn?.classList.remove('loading');
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ===========================
// FORM ENHANCEMENTS
// ===========================

function setupPhoneFormatting() {
    if (!elements.phoneInput) return;
    
    elements.phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.startsWith('91') && value.length > 2) {
            value = '+91 ' + value.substring(2);
        } else if (value.length === 10) {
            value = value.replace(/(\d{5})(\d{5})/, '$1 $2');
        }
        
        e.target.value = value;
    });
}

function setupCharacterCounter() {
    if (!elements.messageTextarea) return;
    
    const counter = document.createElement('div');
    counter.className = 'char-counter';
    Object.assign(counter.style, {
        fontSize: '13px',
        color: '#7d8ca5',
        marginTop: '8px',
        textAlign: 'right'
    });
    
    elements.messageTextarea.parentElement.appendChild(counter);
    
    elements.messageTextarea.addEventListener('input', function() {
        const len = this.value.length;
        const max = CONFIG.MAX_MESSAGE_LENGTH;
        
        counter.textContent = `${len}/${max} characters`;
        
        if (len < CONFIG.MIN_MESSAGE_LENGTH) {
            counter.style.color = '#ff4757';
        } else if (len > max - 50) {
            counter.style.color = '#ffa502';
        } else {
            counter.style.color = '#7d8ca5';
        }
        
        if (len > max) {
            this.value = this.value.substring(0, max);
            counter.textContent = `${max}/${max} characters (max)`;
        }
    });
    
    elements.messageTextarea.dispatchEvent(new Event('input'));
}

// ===========================
// SCROLL EFFECTS
// ===========================

const handleScroll = throttle(() => {
    const scrolled = window.pageYOffset;
    
    // Header shadow
    if (elements.header) {
        elements.header.classList.toggle('is-scrolled', scrolled > 50);
    }
    
    // Back to top button
    if (elements.backToTop) {
        elements.backToTop.classList.toggle('show', scrolled > CONFIG.SCROLL_THRESHOLD);
    }
}, CONFIG.THROTTLE_DELAY);

function setupScrollToTop() {
    elements.backToTop?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===========================
// INTERSECTION OBSERVER
// ===========================

function setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
    );
    
    // Observe elements
    qsa('.ccard, .map-box, .info-panel, .form-panel').forEach(el => observer.observe(el));
}

// ===========================
// MOBILE DRAWER
// ===========================

function setupDrawer() {
    if (!elements.hamburger || !elements.drawer) return;
    
    const openDrawer = () => {
        elements.drawer.classList.add('is-open');
        elements.drawerOverlay?.classList.add('is-open');
        elements.hamburger.classList.add('is-active');
        elements.hamburger.setAttribute('aria-expanded', 'true');
        elements.drawer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };
    
    const closeDrawer = () => {
        elements.drawer.classList.remove('is-open');
        elements.drawerOverlay?.classList.remove('is-open');
        elements.hamburger.classList.remove('is-active');
        elements.hamburger.setAttribute('aria-expanded', 'false');
        elements.drawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };
    
    elements.hamburger.addEventListener('click', openDrawer);
    elements.drawerOverlay?.addEventListener('click', closeDrawer);
    elements.drawerClose?.addEventListener('click', closeDrawer);
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.drawer.classList.contains('is-open')) {
            closeDrawer();
        }
    });
}

// ===========================
// NEWSLETTER
// ===========================

function setupNewsletter() {
    if (!elements.newsletterForm) return;
    
    const input = qs('.newsletter-input', elements.newsletterForm);
    const message = qs('.newsletter-message', elements.newsletterForm);
    const btn = qs('.newsletter-btn', elements.newsletterForm);
    
    if (!input || !message || !btn) return;
    
    elements.newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = input.value.trim();
        message.textContent = '';
        message.className = 'newsletter-message';
        
        if (!email) {
            showMessage('Please enter your email');
            return;
        }
        
        if (!validators.email.test(email)) {
            showMessage('Please enter a valid email');
            return;
        }
        
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
        
        try {
            await simulateAPI({ email }, 1500);
            showMessage('✓ Successfully subscribed!', 'success');
            input.value = '';
        } catch {
            showMessage('✕ Something went wrong', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
    
    function showMessage(text, type = 'error') {
        message.textContent = text;
        message.className = `newsletter-message ${type}`;
    }
}

// ===========================
// SMOOTH SCROLL
// ===========================

function setupSmoothScroll() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (href === '#' || href === '#top') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        
        const target = qs(href);
        if (target) {
            e.preventDefault();
            const top = target.offsetTop - 80;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
}

// ===========================
// LAZY LOAD IMAGES
// ===========================

function setupLazyLoad() {
    if (!('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    });
    
    qsa('img[data-src]').forEach(img => observer.observe(img));
}

// ===========================
// FORM INITIALIZATION
// ===========================

function initForm() {
    if (!elements.form) return;
    
    const inputs = qsa('input, textarea', elements.form);
    
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
        });
    });
    
    elements.form.addEventListener('submit', handleFormSubmit);
}

// ===========================
// DYNAMIC YEAR
// ===========================

function updateCopyrightYear() {
    const copyrightEl = qs('.footer-copyright');
    if (copyrightEl) {
        const year = new Date().getFullYear();
        copyrightEl.textContent = copyrightEl.textContent.replace(/\d{4}/, year);
    }
}

// ==================== Newsletter Form Handling ====================

const newsletterForm = document.getElementById('newsletterForm');
const newsletterInput = document.querySelector('.newsletter-input');
const newsletterMessage = document.getElementById('newsletterMessage');

newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = newsletterInput.value.trim();

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Clear previous messages
    newsletterMessage.textContent = '';
    newsletterMessage.className = '';

    // Validate email
    if (!email) {
        showMessage('Please enter your email address.', 'error');
        newsletterInput.focus();
        return;
    }

    if (!emailRegex.test(email)) {
        showMessage('Please enter a valid email address.', 'error');
        newsletterInput.focus();
        return;
    }

    // Simulate API call
    const btn = newsletterForm.querySelector('.newsletter-btn');
  const originalBtnText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';

  fetch('/api/newsletter/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showMessage('✓ Successfully subscribed! Check your email for confirmation.', 'success');
        newsletterInput.value = '';
      } else {
        showMessage(data.message || 'Subscription failed. Please try again.', 'error');
      }
    })
    .catch(() => {
      showMessage('Network error. Please try again.', 'error');
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    });
});



// ===========================
// INITIALIZATION
// ===========================

function init() {
    // Cache all selectors once
    cacheSelectors();
    
    // Setup all features
    initForm();
    setupPhoneFormatting();
    setupCharacterCounter();
    setupDrawer();
    setupNewsletter();
    setupSmoothScroll();
    setupScrollToTop();
    setupIntersectionObserver();
    setupLazyLoad();
    updateCopyrightYear();
    
    // Attach scroll handler
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial scroll check
    handleScroll();
    
    // Log success
    if (console && console.log) {
        console.log(
            '%c Fair Ford Pharmaceuticals ',
            'background: linear-gradient(to right, #0F4C81, #3FA9F5); color: white; padding: 10px 20px; font-size: 16px; font-weight: bold;'
        );
        console.log(
            '%c Contact Page Optimized & Loaded ',
            'background: #10284d; color: #7fd7ff; padding: 5px 10px; font-size: 12px;'
        );
    }
}

// ===========================
// START
// ===========================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ===========================
// EXPORTS (for testing)
// ===========================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateField, validateForm, debounce, throttle };
}

/* ============================================================
   CART / WISHLIST — Store, sidebars, toasts
   Reads/writes the same localStorage key as search.html so
   items added there appear here and vice-versa.
   ============================================================ */
const _STORAGE_KEY = 'fairford.v1';
const Store = {
    state: { cart: {}, wishlist: [] },
    load() {
        try {
            const raw = localStorage.getItem(_STORAGE_KEY);
            if (raw) this.state = { cart: {}, wishlist: [], ...JSON.parse(raw) };
        } catch(e) {}
    },
    save() {
        try { localStorage.setItem(_STORAGE_KEY, JSON.stringify(this.state)); } catch(e) {}
    },
    cartAdd(id, qty = 1) { this.state.cart[id] = (this.state.cart[id] || 0) + qty; this.save(); },
    cartSet(id, qty)     { if (qty <= 0) delete this.state.cart[id]; else this.state.cart[id] = qty; this.save(); },
    cartRemove(id)       { delete this.state.cart[id]; this.save(); },
    cartCount()          { return Object.values(this.state.cart).reduce((s, n) => s + n, 0); },
    cartEntries()        { return Object.entries(this.state.cart); },
    wishRemove(id)       { const i = this.state.wishlist.indexOf(id); if (i >= 0) { this.state.wishlist.splice(i, 1); this.save(); } },
    wishCount()          { return this.state.wishlist.length; }
};
Store.load();

const _PRODUCTS = [
    { id:'p01', name:'Paracetamol 500mg',      mfr:'Cipla',          pack:'Strip of 10 tabs',   net:9.30,  mrp:15.50,  moq:50,  scheme:'10+1' },
    { id:'p02', name:'Azithromycin 500mg',      mfr:'Sun Pharma',     pack:'Strip of 3 tabs',    net:78.00, mrp:120.00, moq:20,  scheme:'5+1'  },
    { id:'p03', name:'Pantoprazole 40mg',       mfr:"Dr Reddy's",    pack:'Strip of 15 tabs',   net:52.00, mrp:85.00,  moq:30,  scheme:'10+2' },
    { id:'p04', name:'Cetirizine 10mg',         mfr:'Mankind Pharma', pack:'Strip of 10 tabs',   net:13.00, mrp:22.00,  moq:100, scheme:'10+1' },
    { id:'p05', name:'Amoxicillin 500mg',       mfr:'Alkem Labs',     pack:'Strip of 10 caps',   net:60.00, mrp:95.00,  moq:25,  scheme:'5+1'  },
    { id:'p06', name:'Metformin 500mg SR',      mfr:'Lupin',          pack:'Strip of 15 tabs',   net:21.00, mrp:35.00,  moq:50,  scheme:'10+1' },
    { id:'p07', name:'Vitamin D3 60K',          mfr:'Glenmark',       pack:'Pack of 4 sachets',  net:115.00,mrp:180.00, moq:20,  scheme:'10+2' },
    { id:'p08', name:'Atorvastatin 10mg',       mfr:'Torrent Pharma', pack:'Strip of 10 tabs',   net:47.00, mrp:78.00,  moq:30,  scheme:'10+1' },
    { id:'p09', name:'Telmisartan 40mg',        mfr:'Macleods',       pack:'Strip of 10 tabs',   net:39.00, mrp:65.00,  moq:30,  scheme:'10+1' },
    { id:'p10', name:'Omeprazole 20mg',         mfr:'Zydus',          pack:'Strip of 10 caps',   net:25.00, mrp:42.00,  moq:40,  scheme:'10+1' },
    { id:'p11', name:'Glimepiride 2mg',         mfr:'USV',            pack:'Strip of 10 tabs',   net:54.00, mrp:88.00,  moq:25,  scheme:'5+1'  },
    { id:'p12', name:'Methylcobalamin 1500mcg', mfr:'Intas',          pack:'Strip of 10 tabs',   net:68.00, mrp:110.00, moq:30,  scheme:'10+1' }
];

function _productById(id) { return _PRODUCTS.find(p => p.id === id); }
function _inr(n)  { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function _init(n) { return n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function _esc(s)  { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function _toast(msg) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast success';
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>' + _esc(msg) + '</span>';
    stack.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}

function refreshCounters() {
    const cartC = Store.cartCount();
    const wishC = Store.wishCount();
    const cb = document.getElementById('cartCount');
    const wb = document.getElementById('wishlistCount');
    const cs = document.getElementById('cartSideCount');
    const ws = document.getElementById('wishSideCount');
    if (cb) { cb.textContent = cartC; cb.classList.toggle('empty', cartC === 0); }
    if (wb) { wb.textContent = wishC; wb.classList.toggle('empty', wishC === 0); }
    if (cs) cs.textContent = cartC + ' item' + (cartC === 1 ? '' : 's');
    if (ws) ws.textContent = wishC + ' item' + (wishC === 1 ? '' : 's');
}

function openSidebar(which) {
    const el = document.getElementById(which === 'cart' ? 'cartSidebar' : 'wishSidebar');
    const ov = document.getElementById('overlay');
    if (!el) return;
    el.classList.add('is-open');
    if (ov) ov.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (which === 'cart') _renderCart(); else _renderWishlist();
}

function closeSidebar(which) {
    const el = document.getElementById(which === 'cart' ? 'cartSidebar' : 'wishSidebar');
    if (el) el.classList.remove('is-open');
    const cartOpen = document.getElementById('cartSidebar') && document.getElementById('cartSidebar').classList.contains('is-open');
    const wishOpen = document.getElementById('wishSidebar') && document.getElementById('wishSidebar').classList.contains('is-open');
    if (!cartOpen && !wishOpen) {
        const ov = document.getElementById('overlay');
        if (ov) ov.classList.remove('is-open');
        document.body.style.overflow = '';
    }
}

function _renderCart() {
    const body = document.getElementById('cartBody');
    const foot = document.getElementById('cartFoot');
    if (!body) return;
    const entries = Store.cartEntries();
    if (entries.length === 0) {
        body.innerHTML = '<div class="empty-state"><div class="big">Your cart is empty</div><div>Browse products on the <a href="search.html" style="color:#0f4c81">product page</a>.</div></div>';
        if (foot) foot.style.display = 'none';
        return;
    }
    let subtotal = 0, moqViolations = 0;
    body.innerHTML = entries.map(([id, qty]) => {
        const p = _productById(id);
        if (!p) return '';
        const lineTotal = p.net * qty;
        subtotal += lineTotal;
        const underMoq = qty < p.moq;
        if (underMoq) moqViolations++;
        const [paid, free] = p.scheme.split('+').map(Number);
        const bonus = paid && free ? Math.floor(qty / paid) * free : 0;
        return '<div class="line">' +
            '<div class="line-thumb">' + _init(p.name) + '</div>' +
            '<div><p class="line-name">' + _esc(p.name) + '</p>' +
            '<p class="line-comp">' + _esc(p.mfr) + ' · ' + _esc(p.pack) + '</p>' +
            '<p class="line-rate">Net <b>' + _inr(p.net) + '</b> · MOQ ' + p.moq + '</p>' +
            '<div class="qty"><button data-step="-1" data-id="' + p.id + '">−</button>' +
            '<input type="number" min="1" value="' + qty + '" data-qty="' + p.id + '">' +
            '<button data-step="1" data-id="' + p.id + '">+</button></div></div>' +
            '<div class="line-right"><span class="line-total">' + _inr(lineTotal) + '</span>' +
            '<button class="line-remove" data-remove="' + p.id + '">Remove</button></div>' +
            (bonus > 0 ? '<div class="line-scheme-info">+ ' + bonus + ' free unit' + (bonus === 1 ? '' : 's') + ' (scheme ' + p.scheme + ')</div>' : '') +
            (underMoq ? '<div class="line-moq-warn">Below MOQ — add ' + (p.moq - qty) + ' more unit' + (p.moq - qty === 1 ? '' : 's') + '</div>' : '') +
            '</div>';
    }).join('');
    if (foot) {
        const gst = subtotal * 0.12;
        foot.style.display = 'block';
        foot.innerHTML = '<div class="totals">' +
            '<div class="totals-row"><span>Subtotal (' + entries.length + ' SKU' + (entries.length === 1 ? '' : 's') + ')</span><b>' + _inr(subtotal) + '</b></div>' +
            '<div class="totals-row"><span>GST (12%, estimate)</span><b>' + _inr(gst) + '</b></div>' +
            '<div class="totals-row grand"><span>Order Total</span><b>' + _inr(subtotal + gst) + '</b></div></div>' +
            '<button class="btn-checkout" ' + (moqViolations > 0 ? 'disabled' : '') + ' onclick="window.location.href=\'search.html\'">' +
            (moqViolations > 0 ? 'Resolve ' + moqViolations + ' MOQ issue' + (moqViolations === 1 ? '' : 's') : 'Proceed to Checkout') + '</button>' +
            '<p class="foot-note">GST invoice with HSN codes generated on confirmation.</p>';
    }
}

function _renderWishlist() {
    const body = document.getElementById('wishBody');
    if (!body) return;
    const ids = Store.state.wishlist;
    if (ids.length === 0) {
        body.innerHTML = '<div class="empty-state"><div class="big">No saved products</div><div>Save products from the <a href="search.html" style="color:#0f4c81">product page</a>.</div></div>';
        return;
    }
    body.innerHTML = ids.map(id => {
        const p = _productById(id);
        if (!p) return '';
        return '<div class="wish-line">' +
            '<div class="line-thumb">' + _init(p.name) + '</div>' +
            '<div><p class="line-name">' + _esc(p.name) + '</p>' +
            '<p class="line-comp">' + _esc(p.mfr) + ' · ' + _esc(p.pack) + '</p>' +
            '<p class="line-rate">Net <b>' + _inr(p.net) + '</b> · MOQ ' + p.moq + '</p></div>' +
            '<div class="wish-actions">' +
            '<button class="wish-move" data-wmove="' + p.id + '">MOVE TO CART</button>' +
            '<button class="wish-remove" data-wremove="' + p.id + '">Remove</button></div>' +
            '</div>';
    }).join('');
}

/* Wire cart/wishlist icon buttons and sidebar interactions */
(function initCartWishlist() {
    function setup() {
        /* Icon buttons → open sidebar */
        document.querySelectorAll('.icon-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const action = btn.getAttribute('data-action');
                if (action === 'cart') openSidebar('cart');
                else if (action === 'wishlist') openSidebar('wish');
            });
        });

        /* Sidebar close buttons */
        document.querySelectorAll('.sidebar-close').forEach(function(btn) {
            btn.addEventListener('click', function() { closeSidebar(btn.dataset.close); });
        });

        /* Overlay click */
        const ov = document.getElementById('overlay');
        if (ov) ov.addEventListener('click', function() { closeSidebar('cart'); closeSidebar('wish'); });

        /* Cart body interactions */
        const cartBody = document.getElementById('cartBody');
        if (cartBody) {
            cartBody.addEventListener('click', function(e) {
                const step = e.target.closest('[data-step]');
                const rem  = e.target.closest('[data-remove]');
                if (step) {
                    const cur = Store.state.cart[step.dataset.id] || 0;
                    Store.cartSet(step.dataset.id, Math.max(1, cur + Number(step.dataset.step)));
                    refreshCounters(); _renderCart();
                } else if (rem) {
                    Store.cartRemove(rem.dataset.remove);
                    refreshCounters(); _renderCart();
                    _toast('Removed from cart');
                }
            });
            cartBody.addEventListener('change', function(e) {
                const inp = e.target.closest('[data-qty]');
                if (!inp) return;
                Store.cartSet(inp.dataset.qty, Math.max(1, parseInt(inp.value, 10) || 1));
                refreshCounters(); _renderCart();
            });
        }

        /* Wishlist body interactions */
        const wishBody = document.getElementById('wishBody');
        if (wishBody) {
            wishBody.addEventListener('click', function(e) {
                const mv = e.target.closest('[data-wmove]');
                const rm = e.target.closest('[data-wremove]');
                if (mv) {
                    const p = _productById(mv.dataset.wmove);
                    if (p) { Store.cartAdd(p.id, p.moq); Store.wishRemove(p.id); refreshCounters(); _renderWishlist(); _renderCart(); _toast('Moved to cart at MOQ (' + p.moq + ' units)'); }
                } else if (rm) {
                    Store.wishRemove(rm.dataset.wremove);
                    refreshCounters(); _renderWishlist();
                    _toast('Removed from wishlist');
                }
            });
        }

        /* Escape key closes open sidebar */
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { closeSidebar('cart'); closeSidebar('wish'); }
        });

        refreshCounters();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();

// Profile / account button → role-based dashboard redirect
(function () {
  function goToDashboard() {
    var userStr = localStorage.getItem('ff_user');
    if (!userStr) { window.location.href = 'login&signup.html'; return; }
    try {
      var user = JSON.parse(userStr);
      if (user.role === 'ret')                                      window.location.href = 'retailer.html';
      else if (user.role === 'dist')                                 window.location.href = 'distributor.html';
      else if (user.role === 'admin' || user.role === 'superadmin')  window.location.href = 'superadmin.html';
      else                                                            window.location.href = 'index.html';
    } catch (e) { window.location.href = 'login&signup.html'; }
  }
  function wire() {
    var accountBtn = document.querySelector('[data-action="account"]');
    var drawerLink = document.getElementById('drawerProfileLink');
    accountBtn && accountBtn.addEventListener('click', goToDashboard);
    drawerLink && drawerLink.addEventListener('click', function (e) { e.preventDefault(); goToDashboard(); });
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', wire)
    : wire();
})();
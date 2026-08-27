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
        // inquiryType comes from the user now; it used to be hardcoded to
        // 'Business Inquiry' on every submission. Falls back to that same value
        // so the payload stays valid if the select is ever absent.
        const payload = {
            name:        (formData.get('fullName') || '').trim(),
            email:       (formData.get('email') || '').trim(),
            phone:       (formData.get('phone') || '').replace(/\D/g, '').slice(-10),
            message:     (formData.get('message') || '').trim(),
            inquiryType: (formData.get('inquiryType') || 'Business Inquiry').trim(),
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
            // The API returns field-level detail on a 400
            // ({ errors: [{ field, message }] }) and a plain message on 429.
            // Both used to be swallowed in favour of one generic error box, so
            // a rejected phone number or a rate limit read as "something broke".
            if (Array.isArray(json.errors) && json.errors.length) {
                json.errors.forEach(function (err) {
                    // Server field names map to the form's ids, except name→fullName.
                    var id = err.field === 'name' ? 'fullName' : err.field;
                    var input = form.querySelector('#' + id);
                    var slot  = input && input.closest('.cf-field')
                        ? input.closest('.cf-field').querySelector('.error-message')
                        : null;
                    if (input) input.classList.add('error');
                    // .error-message is display:none until .show is added —
                    // matching what validateField() does for client-side errors.
                    if (slot) {
                        slot.textContent = err.message;
                        slot.classList.add('show');
                    }
                });
                var firstBad = form.querySelector('.error');
                if (firstBad) {
                    firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstBad.focus();
                }
            }
            throw new Error(json.message || 'Submission failed');
        }
    } catch (error) {
        if (errorMsg) {
            // Show what actually went wrong rather than a fixed string.
            var textEl = errorMsg.querySelector('p') || errorMsg;
            textEl.textContent = error && error.message
                ? error.message
                : 'Something went wrong. Please try again.';
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

/* The page-local cart/wishlist store that lived here (localStorage key
   'fairford.v1', a hardcoded demo PRODUCTS array, its own sidebars and
   toasts) has been removed. It rendered into the same #cartBody/#cartCount
   nodes as common.js, so this page ran two carts against two storage keys.
   common.js is the single owner; it migrates any leftover legacy cart. */

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
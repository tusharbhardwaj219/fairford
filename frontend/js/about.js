
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

(function () {
  'use strict';

  /* ------------------------------------------------------------
     1. STICKY HEADER — scroll state
     ------------------------------------------------------------ */
  const header = document.getElementById('siteHeader');
  let ticking = false;

  function updateHeaderState() {
    if (window.scrollY > 8) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
    ticking = false;
  }

  // Throttle with requestAnimationFrame for smooth performance
  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(updateHeaderState);
      ticking = true;
    }
  }, { passive: true });

  // Set initial state on load
  updateHeaderState();


  /* ------------------------------------------------------------
     2. MOBILE DRAWER — open / close logic
     ------------------------------------------------------------ */
  const hamburger = document.getElementById('hamburgerBtn');
  const drawer = document.getElementById('mobileDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const drawerClose = document.getElementById('drawerClose');
  const drawerLinks = drawer.querySelectorAll('.drawer-link');

  function openDrawer() {
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    hamburger.classList.add('is-active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Close menu');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // lock body scroll
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    hamburger.classList.remove('is-active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Open menu');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Toggle on hamburger click
  hamburger.addEventListener('click', function () {
    if (drawer.classList.contains('is-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  // Close button + overlay backdrop click
  drawerClose.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Close drawer when a link is tapped
  drawerLinks.forEach(function (link) {
    link.addEventListener('click', closeDrawer);
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  // Close drawer if window resizes up to desktop breakpoint
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth >= 1024 && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    }, 120);
  });


  /* ------------------------------------------------------------
     3. RIGHT-SIDE ICON CLICK HOOKS
     Replace console.log with your real handlers
     (open search modal, navigate to cart route, etc.)
     ------------------------------------------------------------ */
  document.querySelectorAll('.icon-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const action = btn.getAttribute('data-action');
      if (action === 'cart') openSidebar('cart');
      else if (action === 'wishlist') openSidebar('wish');
    });
  });

})();

/* The page-local cart/wishlist store that lived here (localStorage key
   'fairford.v1', a hardcoded demo PRODUCTS array, its own sidebars and
   toasts) has been removed. It rendered into the same #cartBody/#cartCount
   nodes as common.js, so this page ran two carts against two storage keys.
   common.js is the single owner; it migrates any leftover legacy cart. */

/* ============ Fairford homepage — interactions ============ */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Auto-tag elements with .reveal class for scroll animation ----
  // Reveal: section heads, cards, audience cards, dash, phone, testimonials, footer rows
  const revealSelectors = [
    '.section-head',
    '.cat-card',
    '.aud-card',
    '.why-feat',
    '.why-stats',
    '.eco-grid .eco',
    '.dash-wrap',
    '.uphaar-card',
    '.test-card',
    '.partners .partner',
    '.foot-newsletter',
    '.phone-stage',
    '.app-copy',
    '.how-step',
  ];
  document.querySelectorAll(revealSelectors.join(',')).forEach((el, i) => {
    el.classList.add('reveal');
    // staggered delay within a group of siblings
    const parent = el.parentElement;
    if (parent) {
      const sameKind = Array.from(parent.children).filter(c => c.classList.contains('reveal'));
      const idx = sameKind.indexOf(el);
      if (idx >= 0 && idx <= 6) el.setAttribute('data-delay', String(idx));
    }
  });

  // ---- Intersection observer for reveals ----
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  // ---- Count-up animation on stats / KPIs (hero + ecosystem + dashboard) ----
  function parseTarget(text) {
    const m = text.replace(/,/g, '').match(/([0-9.]+)\s*([KMCr]+|%|Cr|L)?/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return { num: n, suffix: m[2] || '', raw: text };
  }
  function formatVal(curr, suffix, decimals) {
    let s = decimals ? curr.toFixed(decimals) : Math.round(curr).toLocaleString('en-IN');
    return s + (suffix ? suffix : '');
  }

  const numberSelectors = [
    '.hero-stats .stat .num span',
    '.eco .num',
    '.why-stats .num',
    '.dash-kpi .val',
    '.up-card-rewards .num',
  ];
  document.querySelectorAll(numberSelectors.join(',')).forEach(el => {
    // Skip if it has nested <small> we shouldn't touch
    const original = el.cloneNode(true);
    const text = el.textContent.trim();
    const t = parseTarget(text);
    if (!t || isNaN(t.num)) return;
    if (t.num < 1) return;
    el.dataset.target = String(t.num);
    el.dataset.suffix = t.suffix;
    el.dataset.original = text;
    // start at 0
    if (text.indexOf('.') === -1) el.textContent = '0' + t.suffix;
    else el.textContent = '0' + t.suffix;
  });

  const countObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.target);
      const original = el.dataset.original;
      const suffix = el.dataset.suffix || '';
      const hasDecimal = original.indexOf('.') !== -1;
      if (isNaN(target)) { countObs.unobserve(el); return; }
      const duration = 1100;
      const start = performance.now();
      function tick(t) {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const curr = target * eased;
        if (hasDecimal) {
          el.textContent = curr.toFixed(1) + suffix;
        } else if (target >= 1000) {
          el.textContent = Math.round(curr).toLocaleString('en-IN') + suffix;
        } else {
          el.textContent = Math.round(curr) + suffix;
        }
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = original;
      }
      requestAnimationFrame(tick);
      countObs.unobserve(el);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-target]').forEach(el => countObs.observe(el));

  // ---- Nav scrolled state ----
  const navWrap = document.querySelector('.nav-wrap');
  const stickyCta = document.querySelector('.sticky-cta');
  const backToTop = document.getElementById('backToTop');
  function onScroll() {
    const y = window.scrollY;
    if (navWrap) {
      if (y > 12) navWrap.classList.add('scrolled');
      else navWrap.classList.remove('scrolled');
    }

    if (stickyCta) {
      if (y > 800) stickyCta.classList.add('show');
      else stickyCta.classList.remove('show');
    }

    if (backToTop) {
      if (y > 400) backToTop.classList.add('show');
      else backToTop.classList.remove('show');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---- Hero parallax for glass cards ----
  const heroStage = document.querySelector('.hero-stage');
  if (heroStage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const cards = heroStage.querySelectorAll('.glass');
    heroStage.addEventListener('mousemove', (e) => {
      const r = heroStage.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width - 0.5;
      const my = (e.clientY - r.top) / r.height - 0.5;
      cards.forEach((c, i) => {
        const depth = (i + 1) * 6;
        c.style.transform = `translate3d(${mx * depth}px, ${my * depth}px, 0)`;
      });
    });
    heroStage.addEventListener('mouseleave', () => {
      cards.forEach(c => c.style.transform = '');
    });
  }

  // ---- After hero entry animation completes, switch cards to float loop ----
  setTimeout(() => {
    document.querySelectorAll('.hero-stage .glass').forEach(el => {
      el.style.animation = 'none';
      el.offsetHeight; // reflow
      el.classList.add('float');
    });
  }, 1400);

  // ---- Mobile menu drawer ----
  const toggle = document.querySelector('.menu-toggle');
  const drawer = document.querySelector('.drawer');
  if (toggle && drawer) {
    const close = drawer.querySelector('.close');
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      drawer.classList.toggle('open');
      document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
    });
    close.addEventListener('click', () => {
      toggle.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    });
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) {
        toggle.classList.remove('open');
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      toggle.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    }));
  }
});
/* ============================================================
   About page polish — scroll-spy interactions
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Scroll spy for chapter index
  const sections = document.querySelectorAll('.about-shell section[id]');
  const links = document.querySelectorAll('.chapter-index a');

  if (!sections.length || !links.length) return;

  const linkMap = new Map();
  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    linkMap.set(id, a);
  });

  function setActive(id) {
    links.forEach(a => a.classList.remove('active'));
    const a = linkMap.get(id);
    if (a) a.classList.add('active');
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      // Find the entry closest to top of viewport that is intersecting
      let best = null;
      let bestTop = Infinity;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const rect = entry.target.getBoundingClientRect();
          if (rect.top >= -100 && rect.top < bestTop) {
            best = entry.target;
            bestTop = rect.top;
          }
        }
      });
      if (best) setActive(best.id);
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    sections.forEach(s => io.observe(s));
  }

  // ---- Newsletter form ----
  const nlForm = document.getElementById('newsletterForm');
  if (nlForm) {
    nlForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = document.getElementById('newsletterMessage');
      if (msg) { msg.textContent = '✓ Thank you for subscribing!'; }
      nlForm.reset();
    });
  }

  // Smooth scroll for chapter links
  links.forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        const offset = 100;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
        history.replaceState(null, '', '#' + id);
      }
    });
  });
});

// =======footer year auto-update=======//
// ==================== Back to Top Button ====================

const backToTopBtn = document.getElementById('backToTop');

// Show/Hide back-to-top button based on scroll position
window.addEventListener('scroll', () => {
  if (window.pageYOffset > 300) {
    backToTopBtn.classList.add('show');
  } else {
    backToTopBtn.classList.remove('show');
  }
});

// Smooth scroll to top when button is clicked
backToTopBtn.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

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
        celebrateSubscription();
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

// Helper function to display messages
function showMessage(message, type) {
  newsletterMessage.textContent = message;
  newsletterMessage.className = type;
  newsletterMessage.style.animation = 'none';
  setTimeout(() => {
    newsletterMessage.style.animation = 'slideIn 0.3s ease-out';
  }, 10);
}

// Add animation for message appearance
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Celebrate subscription with a small effect
function celebrateSubscription() {
  // Create confetti-like effect with subtle animation
  const btn = newsletterForm.querySelector('.newsletter-btn');
  const rect = btn.getBoundingClientRect();

  for (let i = 0; i < 5; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top}px;
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            animation: float-up 0.8s ease-out forwards;
        `;
    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), 800);
  }

  // Add float-up animation if not already in styles
  if (!document.querySelector('style[data-float-animation]')) {
    const floatStyle = document.createElement('style');
    floatStyle.setAttribute('data-float-animation', 'true');
    floatStyle.textContent = `
            @keyframes float-up {
                to {
                    opacity: 0;
                    transform: translateY(-60px) translateX(${Math.random() * 40 - 20}px);
                }
            }
        `;
    document.head.appendChild(floatStyle);
  }
}

// ==================== Link Interactions ====================

const links = document.querySelectorAll('.link-item, .social-icon');

links.forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');

    // Prevent default only if it's a hash link (for demo)
    if (href && href.startsWith('#')) {
      e.preventDefault();

      // Simple notification for demo
      const linkText = link.textContent.trim() || link.title;
      console.log(`Navigating to: ${linkText}`);
    }
  });
});

// ==================== Smooth Scroll for Hash Links ====================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');

    if (href === '#' || href === '') {
      return;
    }

    e.preventDefault();

    const target = document.querySelector(href);

    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// ==================== Keyboard Accessibility ====================

// Allow Enter key to submit newsletter form
newsletterInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    newsletterForm.dispatchEvent(new Event('submit'));
  }
});

// Allow Escape key to close any potential modals (future enhancement)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Handle any open modals here
    console.log('Escape key pressed');
  }
});

// ==================== Performance: Lazy Load Images ====================

if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// ==================== Dynamic Year in Copyright ====================

// Uncomment to auto-update copyright year

const currentYear = new Date().getFullYear();
const copyrightElement = document.querySelector('.copyright p');
if (copyrightElement) {
    copyrightElement.textContent = `© ${currentYear} Fair Ford Pharmaceuticals Pvt. Ltd. All rights reserved.`;
}


// ==================== Form Input Enhancement ====================

// Add focus state to newsletter input for better UX
newsletterInput.addEventListener('focus', function () {
  this.parentElement.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
});

newsletterInput.addEventListener('blur', function () {
  this.parentElement.style.boxShadow = 'none';
});

// ==================== Loading State Management ====================

function setLoadingState(element, isLoading) {
  if (isLoading) {
    element.setAttribute('disabled', 'disabled');
    element.style.opacity = '0.6';
    element.style.cursor = 'not-allowed';
  } else {
    element.removeAttribute('disabled');
    element.style.opacity = '1';
    element.style.cursor = 'pointer';
  }
}

// ==================== Console Welcome Message ====================

console.log('%c🚀 Welcome to YourBrand Footer!',
  'font-size: 20px; color: #3b82f6; font-weight: bold;');
console.log('%cModern, responsive, and fully interactive footer design.',
  'font-size: 14px; color: #64748b;');
console.log('%cVersion 1.0 | Built with HTML, CSS & Vanilla JavaScript',
  'font-size: 12px; color: #94a3b8; font-style: italic;');

// ==================== Mobile Menu Support (Future Enhancement) ====================

// Placeholder for future mobile menu functionality
function initMobileMenu() {
  // Add mobile menu toggle logic here
  const menuToggle = document.querySelector('.menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      console.log('Mobile menu toggled');
    });
  }
}

// Initialize mobile menu when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
});

// ==================== Analytics Placeholder ====================

// Placeholder for analytics tracking
function trackEvent(category, action, label) {
  // Replace with your analytics service (Google Analytics, Mixpanel, etc.)
  console.log(`Event: ${category} > ${action} > ${label}`);
}

// Track newsletter subscription
newsletterForm.addEventListener('submit', () => {
  trackEvent('engagement', 'newsletter', 'subscribe');
});

// Track social media clicks
document.querySelectorAll('.social-icon').forEach(icon => {
  icon.addEventListener('click', (e) => {
    const platform = icon.title;
    trackEvent('social', 'click', platform);
  });
});

// ==================== Utility: Random Welcome Message ====================

const welcomeMessages = [
  "Thanks for exploring our footer!",
  "Made with ❤️ by designers and developers",
  "Fully responsive and ready to use",
  "Customize this footer to match your brand",
  "Questions? Check our Support section above!"
];

const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
console.log(`💡 Tip: ${welcomeMessages[randomIndex]}`);

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

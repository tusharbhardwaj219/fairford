

/* ==============================================================
   AURELIS PHARMA — Premium B2B Header
   script.js
   --------------------------------------------------------------
   Features:
   1. Sticky header — adds .is-scrolled class on scroll
   2. Mobile drawer — open / close / overlay / Escape / resize
   3. Icon button click hooks (search, wishlist, cart, account)
   4. Login / Logout toggle via localStorage
   ============================================================== */

// ==================== LOGIN / LOGOUT STATE ====================
(function initAuthState() {
  const loginNavBtn   = document.getElementById('loginNavBtn');
  const logoutNavBtn  = document.getElementById('logoutNavBtn');
  const drawerLoginBtn  = document.getElementById('drawerLoginBtn');
  const drawerLogoutBtn = document.getElementById('drawerLogoutBtn');

  function updateAuthUI() {
    const isLoggedIn = !!localStorage.getItem('ff_user');
    if (loginNavBtn)   loginNavBtn.style.display   = isLoggedIn ? 'none' : '';
    if (logoutNavBtn)  logoutNavBtn.style.display  = isLoggedIn ? ''     : 'none';
    if (drawerLoginBtn)  drawerLoginBtn.style.display  = isLoggedIn ? 'none' : '';
    if (drawerLogoutBtn) drawerLogoutBtn.style.display = isLoggedIn ? ''     : 'none';
  }

  function logout() {
    if (window.showLogoutConfirm) {
      window.showLogoutConfirm(function () {
        window.lcDoLogout('index.html');
      });
    } else {
      localStorage.removeItem('ff_user');
      localStorage.removeItem('ff_token');
      sessionStorage.removeItem('ff_user');
      updateAuthUI();
    }
  }

  if (logoutNavBtn)  logoutNavBtn.addEventListener('click', logout);
  if (drawerLogoutBtn) drawerLogoutBtn.addEventListener('click', logout);

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


  // Cart and wishlist panels are handled by common.js initPanels()
  // (loaded via the scripts added below script.js in index.html).

})();


/* The old cart/wishlist store lived here (localStorage key 'fairford.v1', a
   hardcoded PRODUCTS array of other manufacturers' medicines, and a flat 12%
   GST constant). It rendered into the same #cartBody/#cartCount nodes as
   common.js, so the homepage ran two carts against two storage keys at once.
   common.js is now the single owner and migrates any leftover legacy cart. */


// =============HERO SLIDER=================//
(function () {
  const track = document.getElementById('heroTrack');
  const dots = document.querySelectorAll('.hero-dot');
  const prevBtn = document.getElementById('heroPrev');
  const nextBtn = document.getElementById('heroNext');
  if (!track) return;

  const total = dots.length;
  let current = 0;
  let autoTimer;
  let hovering = false;

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dots.forEach(function (d, i) {
      d.classList.toggle('active', i === current);
    });
  }

  function startAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(function () { goTo(current + 1); }, 5000);
  }

  function stopAuto() {
    clearInterval(autoTimer);
  }

  // Restart the timer after a manual jump — unless the cursor is still
  // resting on the slides, in which case it stays paused.
  function resetAuto() {
    if (hovering) stopAuto();
    else startAuto();
  }

  prevBtn.addEventListener('click', function () { goTo(current - 1); resetAuto(); });
  nextBtn.addEventListener('click', function () { goTo(current + 1); resetAuto(); });

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      goTo(parseInt(dot.getAttribute('data-index'), 10));
      resetAuto();
    });
  });

  // Pause while the cursor sits on the slides (or the arrows over them);
  // resume as soon as it moves off — dots and stats below keep it running.
  // Skipped on touch-only devices, where a tap fires mouseenter with no
  // matching mouseleave and would leave the slider stuck.
  if (window.matchMedia('(hover: hover)').matches) {
    [track, prevBtn, nextBtn].forEach(function (el) {
      if (!el) return;
      el.addEventListener('mouseenter', function () { hovering = true; stopAuto(); });
      el.addEventListener('mouseleave', function () { hovering = false; startAuto(); });
    });
  }

  // Touch / swipe support
  let touchStartX = 0;
  track.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  track.addEventListener('touchend', function (e) {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { goTo(diff > 0 ? current + 1 : current - 1); resetAuto(); }
  }, { passive: true });

  startAuto();
})();

// =============categories=================//
// SVG Icon Generator
function getIconSVG(iconName, color) {
  const icons = {
    heart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,

    activity: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,

    droplet: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`,

    brain: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path></svg>`,

    bone: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5 .5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"></path></svg>`,

    sparkles: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>`,

    leaf: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>`,

    shield: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,

    plus: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,

    users: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
  };

  return icons[iconName] || icons.heart;
}

/* ------------------------------------------------------------------
   CATALOGUE CATEGORIES
   Loaded from /api/categories at runtime so the cards, their counts and
   their links always reflect what is actually in stock.

   This previously held ten hardcoded "therapeutic divisions" (Cardiac &
   Hypertension, Diabetic Care, …) with invented SKU/brand counts. None of
   them existed as a category in the database, and the whole grid sat inside
   one <a href="product.html">, so every card led to the same unfiltered page.

   The map below is presentation only — icon, accent colour, and the group
   the filter pills use. Categories missing from it still render, via the
   fallback, so a new category added in the admin panel never disappears.
   ------------------------------------------------------------------ */
const CATEGORY_PRESENTATION = {
  'Tablets':           { icon: 'plus',     color: '#0F4C81', group: 'Dosage form' },
  'Capsules':          { icon: 'plus',     color: '#6366F1', group: 'Dosage form' },
  'Syrups':            { icon: 'droplet',  color: '#0EA5E9', group: 'Dosage form' },
  'Drops':             { icon: 'droplet',  color: '#06B6D4', group: 'Dosage form' },
  'Injections':        { icon: 'activity', color: '#EF4444', group: 'Dosage form' },
  'Gels':              { icon: 'sparkles', color: '#8B5CF6', group: 'Dosage form' },
  'Ointments':         { icon: 'sparkles', color: '#A855F7', group: 'Dosage form' },
  'Sachets & Powders': { icon: 'leaf',     color: '#F59E0B', group: 'Dosage form' },
  'Analgesics':        { icon: 'bone',     color: '#F97316', group: 'Therapeutic' },
  'Antifungals':       { icon: 'shield',   color: '#14B8A6', group: 'Therapeutic' },
  'Antibiotics':       { icon: 'shield',   color: '#0891B2', group: 'Therapeutic' },
  'Vitamins':          { icon: 'leaf',     color: '#22C55E', group: 'Wellness' },
  'Personal Care':     { icon: 'users',    color: '#EC4899', group: 'Wellness' }
};
const CATEGORY_FALLBACK = { icon: 'plus', color: '#0F4C81', group: 'Therapeutic' };

// Filled by loadCategories(). Entry shape: {title, count, icon, color, category}
let divisions = [];
let divisionsError = false;

function escDiv(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function loadCategories() {
  return fetch('/api/categories')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      divisions = ((data && data.categories) || [])
        // Only surface categories a buyer can actually order from.
        .filter(function (c) { return c.isActive !== false && c.productCount > 0; })
        .map(function (c) {
          var p = CATEGORY_PRESENTATION[c.categoryName] || CATEGORY_FALLBACK;
          return {
            title: c.categoryName,
            count: c.productCount,
            icon:  p.icon,
            color: p.color,
            category: p.group
          };
        })
        .sort(function (a, b) { return b.count - a.count; });
    })
    .catch(function (err) {
      divisionsError = true;
      console.error('[categories] load failed:', err);
    });
}

// State Management
let currentFilter = 'All';
let searchQuery = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
  renderDivisions();          // paints the loading state
  setupEventListeners();
  loadCategories().then(renderDivisions);
});

// Render Category Cards.
// Each card is an <a>, so it is keyboard-reachable and opens in a new tab on
// middle-click — the old markup was a <div> with a JS click handler, wrapped in
// a page-wide anchor, which gave neither.
function renderDivisions() {
  const grid = document.getElementById('divisionsGrid');
  if (!grid) return;

  const note = (msg) => `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #667085;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 16px;" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p style="font-size: 16px;">${msg}</p>
            </div>`;

  if (divisionsError) { grid.innerHTML = note('Categories could not be loaded. Please refresh the page.'); return; }
  if (!divisions.length) { grid.innerHTML = note('Loading categories…'); return; }

  const filteredDivisions = filterDivisions();
  if (filteredDivisions.length === 0) {
    grid.innerHTML = note('No categories match your search.');
    return;
  }

  grid.innerHTML = filteredDivisions.map(division => `
        <a class="division-card" href="product.html?category=${encodeURIComponent(division.title)}">
            <div class="icon-container" style="background: ${division.color}10;">
                ${getIconSVG(division.icon, division.color)}
            </div>
            <h3 class="division-title">${escDiv(division.title)}</h3>
            <p class="division-meta">${division.count} ${division.count === 1 ? 'product' : 'products'}</p>
            <div class="browse-link">
                <span>Browse category</span>
                <span class="browse-arrow" aria-hidden="true">→</span>
            </div>
        </a>
    `).join('');
}

// Filter Divisions
function filterDivisions() {
  return divisions.filter(division => {
    // Filter by category
    const categoryMatch = currentFilter === 'All' || division.category === currentFilter;

    // Filter by search query
    const searchMatch = searchQuery === '' ||
      division.title.toLowerCase().includes(searchQuery.toLowerCase());

    return categoryMatch && searchMatch;
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Filter Pills
  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', function () {
      // Remove active class from all pills
      filterPills.forEach(p => p.classList.remove('active'));

      // Add active class to clicked pill
      this.classList.add('active');

      // Update filter and re-render
      currentFilter = this.getAttribute('data-filter');
      renderDivisions();
    });
  });

  // Search Input
  // The homepage catalogue is now five static category cards, so this
  // control is absent there — guard it or the rest of init never runs.
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', function (e) {
    searchQuery = e.target.value;
    renderDivisions();
  });

  // NOTE: the section's two CTAs are plain links (to the e-catalogue PDF and to
  // product.html). They used to be wired here via document.querySelector(
  // '.btn-primary'), which matches the FIRST .btn-primary in the document — the
  // hero's "Open partner portal" — so the hero CTAs fired placeholder alert()s.
}


// Debounce function for search optimization
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Optional: Add smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Optional: Intersection Observer for scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

// Observe animated elements
document.querySelectorAll('.animate-in').forEach(el => {
  observer.observe(el);
});


// =============top selling products slider===========//
/* ==========================================================================
   TOP SELLING PRODUCTS — SWIPER INITIALIZATION
   Features: infinite loop, autoplay (3s) with hover pause, touch swipe,
             custom navigation, modern pagination, fully responsive.
   ========================================================================== */

(function initTopProductsSlider() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    // The home "Top Selling" carousel was replaced by the live product
    // showcase (js/home-products.js). This whole module now only matters if
    // the old `.products-swiper` markup is present, so no-op otherwise.
    if (!document.querySelector('.products-swiper')) return;

    // Make sure Swiper loaded
    if (typeof Swiper === 'undefined') {
      console.warn('[TopProducts] Swiper.js not found — slider will not initialize.');
      return;
    }

    /* -------- Swiper Instance -------- */
    const productsSwiper = new Swiper('.products-swiper', {
      // Layout
      slidesPerView: 1.5,
      spaceBetween: 20,
      centeredSlides: false,
      grabCursor: true,
      watchSlidesProgress: true,

      // Infinite loop
      loop: true,
      loopAdditionalSlides: 4,

      // Speed & easing — long duration with linear timing gives the
      // smooth "auto-flow" feel of premium SaaS sliders.
      speed: 800,

      // Autoplay every 3 seconds, pause on hover
      autoplay: {
        delay: 3000,
        disableOnInteraction: false,   // keep playing after user interaction
        pauseOnMouseEnter: true,       // pause on hover (built-in support)
      },

      // Touch / swipe
      touchEventsTarget: 'container',
      threshold: 5,
      touchRatio: 1,
      simulateTouch: true,
      resistanceRatio: 0.65,

      // Keyboard support for accessibility
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },

      // Mouse wheel (subtle — only horizontal)
      mousewheel: {
        forceToAxis: true,
        sensitivity: 0.6,
        thresholdDelta: 30,
      },

      // Pagination
      pagination: {
        el: '.products-pagination',
        clickable: true,
        dynamicBullets: false,
        renderBullet: function (index, className) {
          return '<button class="' + className + '" aria-label="Go to slide ' + (index + 1) + '"></button>';
        },
      },

      // Navigation
      navigation: {
        nextEl: '.nav-arrow--next',
        prevEl: '.nav-arrow--prev',
      },

      // A11y
      a11y: {
        enabled: true,
        prevSlideMessage: 'Previous product',
        nextSlideMessage: 'Next product',
        paginationBulletMessage: 'Go to product {{index}}',
      },

      // Responsive breakpoints — mobile-first
      breakpoints: {
        // Small tablet
        540: {
          slidesPerView: 2,
          spaceBetween: 20,
        },
        // Tablet
        768: {
          slidesPerView: 2.5,
          spaceBetween: 22,
        },
        // Small desktop / 13-inch laptop
        1024: {
          slidesPerView: 3,
          spaceBetween: 24,
        },
        // 13-inch full width and above — 4 cards
        1280: {
          slidesPerView: 4,
          spaceBetween: 24,
        },
      },

      // Lifecycle events
      on: {
        init: function () {
          // Fade-in the slider once ready
          const wrapper = document.querySelector('.slider-wrapper');
          if (wrapper) {
            wrapper.style.opacity = '0';
            wrapper.style.transform = 'translateY(20px)';
            wrapper.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            requestAnimationFrame(() => {
              wrapper.style.opacity = '1';
              wrapper.style.transform = 'translateY(0)';
            });
          }
        },
      },
    });

    /* -------- Pause autoplay when tab is hidden (saves CPU) -------- */
    document.addEventListener('visibilitychange', function () {
      if (!productsSwiper || !productsSwiper.autoplay) return;
      if (document.hidden) {
        productsSwiper.autoplay.stop();
      } else {
        productsSwiper.autoplay.start();
      }
    });

    /* -------- Pause on focus-within (keyboard users) -------- */
    const sliderRoot = document.querySelector('.products-swiper');
    if (sliderRoot) {
      sliderRoot.addEventListener('focusin', () => productsSwiper.autoplay?.stop());
      sliderRoot.addEventListener('focusout', () => productsSwiper.autoplay?.start());
    }

    /* -------- Bulk Order button — interaction hook -------- */
    // Each "Bulk Order" CTA opens a quote flow. Hook your real handler here
    // (modal / route / analytics event). This is just a graceful default.
    document.querySelectorAll('.btn-bulk').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const card = btn.closest('.product-card');
        const productName = card?.querySelector('.product-card__title')?.textContent?.trim() || 'Product';

        // Replace with your modal / router / API call
        console.log('[TopProducts] Bulk order requested:', productName);

        // Visual feedback
        btn.style.transform = 'translateY(-2px) scale(0.97)';
        setTimeout(() => { btn.style.transform = ''; }, 200);
      });
    });

    /* -------- Lazy-load fallback for older browsers -------- */
    // Modern browsers handle loading="lazy" natively; this is a small safety net.
    if (!('loading' in HTMLImageElement.prototype) && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '200px' });

      document.querySelectorAll('.product-card img[loading="lazy"]').forEach(function (img) {
        io.observe(img);
      });
    }

    // Expose to window for debugging / external control (optional)
    window.__productsSwiper = productsSwiper;
  }
})();


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

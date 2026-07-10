/* ============================================
   INITIALIZATION
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    initScrollEffects();
    initHamburger();
    initSmoothScroll();
    initBackToTop();
    initScrollProgress();
    renderRetailerSchemes();
    initIntersectionAnimations();
    initButtonActions();
    initSchemeModal();
});

/* ============================================
   RETAILER SCHEME CARDS
   Data sourced from the "Retailer Box Scheme 2026-27" slabs in the
   Uphar Ki Bahar 3.0 brochure (uphar-ki-bahar-3.0.pdf).
   ============================================ */
const UPHAAR_PDF = '/uphar-ki-bahar-3.0.pdf';

const RETAILER_SCHEMES = [
    { box: '3 Box',   gift: '1 Kg Branded Rice',              alt: null,                                derma: '6 PC Dermazest 6',   icon: '🍚' },
    { box: '6 Box',   gift: '2 Pc Wellspun Hand Towel Set',   alt: null,                                derma: '12 PC Dermazest 6',  icon: '🧺' },
    { box: '12 Box',  gift: '1 Ltr. Milton Steel Bottle',     alt: 'Branded 5 Ltr. Mayur Jug',          derma: '24 PC Dermazest 6',  icon: '🍶' },
    { box: '18 Box',  gift: 'Branded 3.5 Ltr. Steel Casserole', alt: 'Milton 6 Pc Steel Softline Tiffin', derma: '36 PC Dermazest 6', icon: '🍲' },
    { box: '24 Box',  gift: 'Branded 1.8 Ltr. Electric Kettle', alt: 'Prestige Iron',                   derma: '48 PC Dermazest 6',  icon: '🫖' },
    { box: '30 Box',  gift: '3 Pc Cello Bathroom Set',        alt: 'Branded 4 Pc Towel Set',            derma: '54 PC Dermazest 6',  icon: '🛁' },
    { box: '60 Box',  gift: 'Branded 65 Cm Luggage Bag',      alt: 'Branded 15 Ltr. Steel Mayur Jug',   derma: '120 PC Dermazest 6', icon: '🧳' },
    { box: '75 Box',  gift: 'Branded 48" Ceiling Fan',        alt: 'Branded Smart Watch',               derma: '150 PC Dermazest 6', icon: '🌀' },
    { box: '100 Box', gift: 'Prestige 3 Pc Non-Stick Cookware', alt: 'Branded Speaker',                 derma: '200 PC Dermazest 6', icon: '🍳' },
    { box: '150 Box', gift: 'Branded 4.2 Ltr. Air Fryer',     alt: 'Branded Ladder 4 Step',             derma: '300 PC Dermazest 6', icon: '🍤' },
    { box: '200 Box', gift: 'Cello Copper Matka 10 Ltr.',     alt: 'Branded Office Chair',              derma: '400 PC Dermazest 6', icon: '🏺' },
    { box: '250 Box', gift: 'Branded 36 Ltr. Air Cooler',     alt: 'Branded 60 Cm Chimney',             derma: '500 PC Dermazest 6', icon: '❄️' },
    { box: '325 Box', gift: 'Branded Water Dispenser',        alt: 'Branded 20 Ltr. Microwave',         derma: '650 PC Dermazest 6', icon: '🚰' },
];

const SCHEME_VALIDITY = 'Valid till 31 March 2027';
const SCHEME_CATEGORY = 'Retailer Offer';

// Inline SVG icons (kept as strings so they inject cleanly into the templates).
const SVG_GIFT = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#002C5F" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8"/><path d="M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8"/></svg>';
const SVG_CAL  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const SVG_TAG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></svg>';
const SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const SVG_PDF  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

// Escape user-facing strings before injecting into innerHTML (defensive).
function schemeEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
    ));
}

function renderRetailerSchemes() {
    const grid = document.getElementById('schemeGrid');
    if (!grid) return;

    grid.innerHTML = RETAILER_SCHEMES.map((s, i) => `
        <article class="scheme-card" style="animation-delay:${(i % 3) * 0.08}s">
            <div class="scheme-card-top">
                <div class="scheme-card-icon">${SVG_GIFT}</div>
                <span class="scheme-badge">Active</span>
            </div>
            <div class="scheme-card-qty">${schemeEsc(s.box)}</div>
            <h3 class="scheme-card-title">${schemeEsc(s.gift)} <span>Free</span></h3>
            <p class="scheme-card-desc">Purchase ${schemeEsc(s.box)} of eligible products and receive ${schemeEsc(s.gift)} absolutely free.</p>
            <ul class="scheme-card-meta">
                <li><span class="scheme-meta-label">${SVG_CAL} Validity</span><span>${SCHEME_VALIDITY}</span></li>
                <li><span class="scheme-meta-label">${SVG_TAG} Category</span><span>${SCHEME_CATEGORY}</span></li>
            </ul>
            <div class="scheme-card-actions">
                <button class="scheme-btn scheme-btn-primary" onclick="openSchemeDetails(${i})">View Details</button>
                <button class="scheme-btn scheme-btn-ghost" onclick="viewSchemePdf()">${SVG_PDF} View PDF</button>
            </div>
        </article>
    `).join('');
}

// Open the existing Uphaar brochure PDF in a new browser tab (unchanged file).
function viewSchemePdf() {
    window.open(UPHAAR_PDF, '_blank', 'noopener');
}

function openSchemeDetails(index) {
    const s = RETAILER_SCHEMES[index];
    const modal = document.getElementById('schemeModal');
    const title = document.getElementById('schemeModalTitle');
    const body = document.getElementById('schemeModalBody');
    if (!s || !modal || !body) return;

    title.textContent = `${s.box} → ${s.gift}`;

    const options = [`<li><strong>${schemeEsc(s.gift)}</strong></li>`];
    if (s.alt)   options.push(`<li><strong>${schemeEsc(s.alt)}</strong></li>`);
    if (s.derma) options.push(`<li><strong>${schemeEsc(s.derma)}</strong></li>`);

    body.innerHTML = `
        <p class="scheme-modal-lead">Buy <strong>${schemeEsc(s.box)}</strong> of eligible products and choose <strong>any one</strong> of the following gifts:</p>
        <ul class="scheme-modal-options">${options.join('')}</ul>
        <div class="scheme-modal-meta">
            <div><span>${SVG_CAL} Validity</span><strong>${SCHEME_VALIDITY}</strong></div>
            <div><span>${SVG_TAG} Category</span><strong>${SCHEME_CATEGORY}</strong></div>
            <div><span>${SVG_CHECK} Status</span><strong>Active</strong></div>
        </div>
        <p class="scheme-modal-note">Annual scheme is applicable. Gift images are for representation; actual product may differ. Terms &amp; conditions apply as per the brochure.</p>
        <button class="scheme-btn scheme-btn-ghost scheme-modal-pdf" onclick="viewSchemePdf()">${SVG_PDF} View Full Brochure (PDF)</button>
    `;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeSchemeDetails() {
    const modal = document.getElementById('schemeModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function initSchemeModal() {
    const modal = document.getElementById('schemeModal');
    const closeBtn = document.getElementById('schemeModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeSchemeDetails);
    if (modal) {
        modal.addEventListener('click', (e) => { if (e.target === modal) closeSchemeDetails(); });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSchemeDetails(); });
}

/* ============================================
   SCROLL EFFECTS - STICKY HEADER
   ============================================ */
function initScrollEffects() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    let lastScrollY = 0;
    let isScrolling = false;

    window.addEventListener('scroll', () => {
        lastScrollY = window.scrollY;
        
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                navbar.classList.toggle('scrolled', lastScrollY > 80);
                isScrolling = false;
            });
            isScrolling = true;
        }
    }, { passive: true });
}

/* ============================================
   HAMBURGER MENU
   ============================================ */
function initHamburger() {
    const hamburger = document.getElementById('hamburger');
    const navMobile = document.getElementById('navMobile');

    if (!hamburger || !navMobile) return;

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navMobile.classList.toggle('open');
        hamburger.classList.toggle('open', isOpen);
        hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    // Close menu when a link is clicked
    navMobile.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navMobile.classList.remove('open');
            hamburger.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !navMobile.contains(e.target)) {
            navMobile.classList.remove('open');
            hamburger.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
        }
    });
}

/* ============================================
   SMOOTH SCROLLING
   ============================================ */
function initSmoothScroll() {
    // Desktop nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', handleSmoothScroll);
    });

    // Mobile nav links
    document.querySelectorAll('.nav-links-mobile a').forEach(link => {
        link.addEventListener('click', handleSmoothScroll);
    });

    // Explore button
    const exploreBtn = document.getElementById('exploreBtn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            const section = document.getElementById('reward-tiers') || document.getElementById('how-it-works');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
}

function handleSmoothScroll(e) {
    const href = this.getAttribute('href');
    if (!href.startsWith('#')) return;

    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/* ============================================
   BACK TO TOP BUTTON
   ============================================ */
function initBackToTop() {
    const backToTop = document.getElementById('backToTop');
    if (!backToTop) return;

    window.addEventListener('scroll', () => {
        backToTop.classList.toggle('visible', window.scrollY > 600);
    }, { passive: true });

    backToTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/* ============================================
   SCROLL PROGRESS BAR
   ============================================ */
function initScrollProgress() {
    const progressBar = document.getElementById('scrollProgress');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = (window.scrollY / scrollHeight) * 100;
        progressBar.style.width = scrolled + '%';
    }, { passive: true });
}

/* ============================================
   INTERSECTION OBSERVER - SCROLL ANIMATIONS
   ============================================ */
function initIntersectionAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    });

    // Observe all step cards
    document.querySelectorAll('.step-card').forEach(card => {
        observer.observe(card);
    });

    // You can extend this for other sections
    document.querySelectorAll('[data-animate]').forEach(el => {
        observer.observe(el);
    });
}

/* ============================================
   BUTTON ACTIONS
   ============================================ */
function initButtonActions() {
    const downloadBtn = document.getElementById('downloadBtn');
    const ctaJoinBtn = document.getElementById('ctaJoinBtn');
    const ctaContactBtn = document.getElementById('ctaContactBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = '/uphar-ki-bahar-3.0.pdf';
            a.download = 'Uphar Ki Bahar 3.0.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    if (ctaJoinBtn) {
        ctaJoinBtn.addEventListener('click', () => {
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    if (ctaContactBtn) {
        ctaContactBtn.addEventListener('click', () => {
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // Contact action buttons
    initContactActionButtons();
}

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

// Debounce function for performance
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/* ============================================
   CONTACT ACTION BUTTONS
   ============================================ */
function initContactActionButtons() {
    // Call button
    const callBtn = document.querySelector('.btn-call');
    if (callBtn) {
        callBtn.addEventListener('click', () => {
            window.location.href = 'tel:9958584020';
        });
    }

    // Email button
    const emailBtn = document.querySelector('.btn-email');
    if (emailBtn) {
        emailBtn.addEventListener('click', () => {
            window.location.href = 'mailto:info@fairfordpharma.com';
        });
    }

    // WhatsApp button
    const whatsappBtn = document.querySelector('.btn-whatsapp');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', () => {
            const phoneNumber = '919958584020'; // Format: country code + number
            const message = 'Hello! I am interested in Uphar Ki Bahar 3.0 scheme.';
            window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
        });
    }

    // Location button
    const locationBtn = document.querySelector('.btn-location');
    if (locationBtn) {
        locationBtn.addEventListener('click', () => {
            const latitude = 28.4089;
            const longitude = 77.0193;
            window.open(`https://maps.google.com/?q=${latitude},${longitude}`, '_blank');
        });
    }
}
/* ============================================
   INITIALIZATION
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    initScrollEffects();
    initHamburger();
    initSmoothScroll();
    initBackToTop();
    initScrollProgress();
    initIntersectionAnimations();
    initButtonActions();
});

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
// ── Mobile Menu ──
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

menuBtn.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("active");
    menuBtn.setAttribute("aria-expanded", isOpen);
    menuBtn.querySelector("i").className = isOpen
        ? "ri-close-line"
        : "ri-menu-3-line";
});

// Close menu when a nav link is clicked
navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.querySelector("i").className = "ri-menu-3-line";
    });
});

// Close menu on outside click
document.addEventListener("click", (e) => {
    if (!navLinks.contains(e.target) && !menuBtn.contains(e.target)) {
        navLinks.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.querySelector("i").className = "ri-menu-3-line";
    }
});

// ── Scroll Progress Bar ──
const progressBar = document.getElementById("scrollProgress");

function updateScrollProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + "%";
}

// ── Navbar Shadow on Scroll ──
const navbar = document.querySelector(".navbar");

function updateNavbar() {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
}

// ── Back to Top ──
const backToTop = document.getElementById("backToTop");

function updateBackToTop() {
    backToTop.classList.toggle("visible", window.scrollY > 400);
}

backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ── Consolidated scroll listener ──
window.addEventListener("scroll", () => {
    updateScrollProgress();
    updateNavbar();
    updateBackToTop();
}, { passive: true });

// ── Reveal Animation (IntersectionObserver) ──
const reveals = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
);

reveals.forEach(el => revealObserver.observe(el));

// ── Active Sidebar Link (IntersectionObserver) ──
const sections = document.querySelectorAll("section[id]");
const sidebarLinks = document.querySelectorAll(".sidebar-link");

const sectionObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                sidebarLinks.forEach(link => {
                    const isActive = link.getAttribute("data-section") === id;
                    link.classList.toggle("active", isActive);
                });
            }
        });
    },
    { threshold: 0.35, rootMargin: "-80px 0px -40% 0px" }
);

sections.forEach(section => sectionObserver.observe(section));

// ── Initial states ──
updateScrollProgress();
updateNavbar();
updateBackToTop();

// privacy&policy.js — Privacy Policy page interactions
// Note: page-chrome.js replaces the inline navbar with the shared site header.
// All navbar/mobile-menu code that referenced the old inline header has been removed.

(function () {
  'use strict';

  var progressBar = document.getElementById('scrollProgress');
  var backToTop   = document.getElementById('backToTop');

  // ── Back to Top ──
  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function updateScrollProgress() {
    if (!progressBar) return;
    var scrollTop  = window.scrollY;
    var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
  }

  function updateBackToTop() {
    if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 400);
  }

  window.addEventListener('scroll', function () {
    updateScrollProgress();
    updateBackToTop();
  }, { passive: true });

  updateScrollProgress();
  updateBackToTop();

  // ── Reveal Animation (Web Animations API) ──
  // Cards are visible by default (see .reveal in privacy&policy.css); this only
  // plays an entrance as each card scrolls into view. Using WAAPI rather than a
  // CSS class toggle keeps content robust — if JS/observer never runs, the text
  // is already shown — and renders in transition-freezing preview engines.
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.animate) {
          el.animate(
            [ { opacity: 0, transform: 'translateY(28px)' },
              { opacity: 1, transform: 'none' } ],
            { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
          );
        }
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  // ── Active Sidebar Link via IntersectionObserver ──
  var sections     = document.querySelectorAll('section[id]');
  var sidebarLinks = document.querySelectorAll('.pp-nav-link[data-section]');

  if ('IntersectionObserver' in window && sections.length && sidebarLinks.length) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          sidebarLinks.forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('data-section') === id);
          });
        }
      });
    }, { threshold: 0.35, rootMargin: '-80px 0px -40% 0px' });

    sections.forEach(function (sec) { sectionObserver.observe(sec); });
  }

  // ── Smooth Scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

})();

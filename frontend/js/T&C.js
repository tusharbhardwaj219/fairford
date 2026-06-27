// T&C.js — Terms & Conditions page interactions
(function () {
  'use strict';

  var progress  = document.getElementById('tcProgress');
  var backToTop = document.getElementById('backToTop');

  // Collect section refs once DOM is ready
  var sections = [];
  var navLinks  = [];

  // ── Scroll Progress & Sidebar Active State ──
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;

    // Scroll progress bar
    if (progress) {
      var total = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      progress.style.width = total > 0 ? (y / total * 100) + '%' : '0%';
    }

    // Back-to-top visibility
    if (backToTop) {
      backToTop.classList.toggle('is-visible', y > 400);
    }

    // Active sidebar link (scroll-based fallback if IntersectionObserver unavailable)
    if (navLinks.length && sections.length && !window._tcSectionObserver) {
      var current = '';
      sections.forEach(function (sec) {
        if (y >= sec.offsetTop - 160) current = sec.id;
      });
      navLinks.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('data-section') === current);
      });
    }

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  onScroll(); // run once on load

  // ── Back to Top ──
  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Init after DOM is ready (page-chrome.js inserts shared header via DOMContentLoaded) ──
  document.addEventListener('DOMContentLoaded', function () {

    // Cache sections & nav links after page-chrome has run
    sections = Array.prototype.slice.call(document.querySelectorAll('section[id]'));
    navLinks  = Array.prototype.slice.call(document.querySelectorAll('.tc-nav-link[data-section]'));

    // ── IntersectionObserver for active sidebar link ──
    if ('IntersectionObserver' in window && sections.length && navLinks.length) {
      var sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.id;
            navLinks.forEach(function (link) {
              link.classList.toggle('is-active', link.getAttribute('data-section') === id);
            });
          }
        });
      }, { threshold: 0.30, rootMargin: '-72px 0px -42% 0px' });

      sections.forEach(function (sec) { sectionObserver.observe(sec); });
      window._tcSectionObserver = sectionObserver;
    }

    // ── Scroll Reveal ──
    if ('IntersectionObserver' in window) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

      document.querySelectorAll('.reveal').forEach(function (el) {
        revealObserver.observe(el);
      });
    } else {
      // Fallback: show everything immediately
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('is-visible');
      });
    }

    // ── FAQ Accordion ──
    document.querySelectorAll('.tc-faq-q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item   = btn.closest('.tc-faq-item');
        var isOpen = item.classList.contains('is-open');

        // Close all open items
        document.querySelectorAll('.tc-faq-item.is-open').forEach(function (open) {
          open.classList.remove('is-open');
          open.querySelector('.tc-faq-q').setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          // Smooth scroll into view if partially hidden
          setTimeout(function () {
            var rect = item.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) {
              item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 50);
        }
      });

      // Keyboard: Space/Enter to toggle
      btn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          btn.click();
        }
      });
    });

    // ── Smooth Scroll for anchor links ──
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href');
        if (!href || href === '#') return;
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          var headerH = 88;
          var top = target.getBoundingClientRect().top + window.scrollY - headerH;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });

  });

})();

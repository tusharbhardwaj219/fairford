/* ==================================================================
   FAIR FORD PHARMACEUTICALS — HOMEPAGE
   home.js · pairs with css/home.css
   ------------------------------------------------------------------
   Three independent pieces, each a no-op when its markup is absent:
     1. the hero slider (blur + fade, autoplay, swipe, keyboard)
     2. the statistics counters (count up together, once, on view)
     3. a shared scroll-reveal observer

   Vanilla JS, no dependencies. Loaded with defer.
   ================================================================== */
(function () {
    'use strict';

    var $  = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

    var reduced = false;
    try {
        reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* older browser — assume motion is fine */ }

    /* ==============================================================
       1 · HERO SLIDER
       Each slide holds the artwork twice (a blurred ambient fill and
       the contained original), so switching slides is purely a class
       swap — CSS owns the blur/fade. That keeps the transition on the
       compositor and means no layout property is ever animated.
       ============================================================== */
    function initHero() {
        var hero = $('#fhHero');
        if (!hero) return;

        var slides = $$('.fh-slide', hero);
        var bars   = $$('.fh-bar', hero);
        var dots   = $$('.fh-dot', hero);
        if (slides.length < 2) return;

        var HOLD = 3000;            // visible time per slide, before the dissolve
        var index = 0;
        var holdTimer = null;       // owns the advance
        var fillRaf = null;         // owns the cosmetic dot fill only
        var startedAt = 0;
        var paused = false;
        var visible = true;

        function show(i) {
            index = (i + slides.length) % slides.length;
            slides.forEach(function (s, n) {
                var on = n === index;
                s.classList.toggle('is-active', on);
                s.setAttribute('aria-hidden', on ? 'false' : 'true');
            });
            // Caption bars cross-fade with the artwork. Links in a hidden bar
            // are taken out of the tab order so keyboard focus cannot land on
            // an invisible control.
            bars.forEach(function (b, n) {
                var on = n === index;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-hidden', on ? 'false' : 'true');
                $$('a', b).forEach(function (a) {
                    if (on) a.removeAttribute('tabindex');
                    else a.setAttribute('tabindex', '-1');
                });
            });
            dots.forEach(function (d, n) {
                d.classList.toggle('is-active', n === index);
                d.setAttribute('aria-current', n === index ? 'true' : 'false');
                var fill = $('.fh-dot__fill', d);
                if (fill) fill.style.width = '0%';
            });
            restart();
        }

        function next() { show(index + 1); }
        function prev() { show(index - 1); }

        /* The advance is driven by a timer, NOT by requestAnimationFrame.
           rAF is only ever used for the dot's progress fill, which is purely
           cosmetic — so if a renderer withholds animation frames (background
           tab, suspended compositor) the slider still changes slides instead
           of freezing on slide one. */
        function clearClock() {
            clearTimeout(holdTimer);
            holdTimer = null;
            if (fillRaf) { cancelAnimationFrame(fillRaf); fillRaf = null; }
        }

        function restart() {
            clearClock();
            if (paused || !visible || reduced) return;

            startedAt = Date.now();
            holdTimer = setTimeout(next, HOLD);

            var fill = dots[index] && $('.fh-dot__fill', dots[index]);
            if (!fill) return;
            (function paint() {
                var pct = Math.min(100, ((Date.now() - startedAt) / HOLD) * 100);
                fill.style.width = pct + '%';
                if (pct < 100) fillRaf = requestAnimationFrame(paint);
            })();
        }

        function setPaused(v) {
            if (paused === v) return;
            paused = v;
            restart();
        }

        hero.addEventListener('mouseenter', function () { setPaused(true); });
        hero.addEventListener('mouseleave', function () { setPaused(false); });
        hero.addEventListener('focusin',    function () { setPaused(true); });
        hero.addEventListener('focusout',   function () { setPaused(false); });

        // Arrows were removed from the deck — paging is by dot, swipe and
        // arrow key. prev() is still used by the keyboard handler below.

        dots.forEach(function (d, n) {
            d.addEventListener('click', function () { show(n); });
        });

        hero.addEventListener('keydown', function (ev) {
            if (ev.key === 'ArrowLeft')  { prev(); ev.preventDefault(); }
            if (ev.key === 'ArrowRight') { next(); ev.preventDefault(); }
        });

        /* Touch swipe. Vertical scrolling is deliberately left alone. */
        var sx = 0, sy = 0, swiping = false;
        hero.addEventListener('pointerdown', function (ev) {
            if (ev.pointerType === 'mouse') return;
            sx = ev.clientX; sy = ev.clientY; swiping = true;
            setPaused(true);
        }, { passive: true });

        hero.addEventListener('pointerup', function (ev) {
            if (!swiping) return;
            swiping = false;
            var dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) next(); else prev();
            }
            setPaused(false);
        }, { passive: true });

        hero.addEventListener('pointercancel', function () {
            swiping = false; setPaused(false);
        }, { passive: true });

        // Only run the clock while the hero is actually on screen.
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                var was = visible;
                visible = entries[0].isIntersecting;
                if (was !== visible) restart();
            }, { threshold: 0.15 }).observe(hero);
        }

        document.addEventListener('visibilitychange', function () {
            setPaused(document.hidden);
        });

        show(0);          // show() ends in restart(), which starts the clock
    }

    /* ==============================================================
       2 · STATISTIC COUNTERS
       Both counters are driven by ONE clock so they finish together,
       regardless of their different target values.
       ============================================================== */
    function initCounters() {
        var wrap = $('#fhStats');
        if (!wrap) return;

        var nums = $$('[data-count]', wrap);
        if (!nums.length) return;

        var DURATION = 1900;
        var ran = false;

        function paint(el, value) {
            var target = parseFloat(el.getAttribute('data-count'));
            // 100000 reads as "100K"; anything smaller stays a plain integer.
            if (target >= 1000) {
                el.textContent = Math.round(value / 1000) + 'K';
            } else {
                el.textContent = Math.round(value).toLocaleString('en-IN');
            }
        }

        function run() {
            if (ran) return;
            ran = true;

            if (reduced) {
                nums.forEach(function (el) { paint(el, parseFloat(el.getAttribute('data-count'))); });
                return;
            }

            var t0 = null;
            function step(ts) {
                if (t0 === null) t0 = ts;
                var p = Math.min(1, (ts - t0) / DURATION);
                var e = 1 - Math.pow(1 - p, 3);           // ease-out cubic
                nums.forEach(function (el) {
                    paint(el, parseFloat(el.getAttribute('data-count')) * e);
                });
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) { run(); io.disconnect(); }
                });
            }, { threshold: 0.35 });
            io.observe(wrap);
        } else {
            run();
        }

        // Never leave a zero on screen if rAF is starved (background tab).
        setTimeout(function () {
            if (!ran) { nums.forEach(function (el) { paint(el, parseFloat(el.getAttribute('data-count'))); }); }
        }, 6000);
    }

    /* ==============================================================
       3 · SCROLL REVEAL
       ============================================================== */
    function initReveal() {
        var items = $$('.fh-rise');
        if (!items.length) return;

        if (!('IntersectionObserver' in window) || reduced) {
            document.body.classList.add('fh-noreveal');
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                io.unobserve(e.target);       // reveal once, then stop watching
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

        items.forEach(function (el) { io.observe(el); });

        // Safety net: .fh-rise starts at opacity 0, so if the observer never
        // delivers (a suspended/background renderer gets no rendering
        // opportunities) the content would stay invisible for good. Reveal
        // everything unconditionally after a short grace period.
        setTimeout(function () {
            items.forEach(function (el) { el.classList.add('is-in'); });
        }, 2500);
    }

    /* ==============================================================
       4 · PRODUCT CARDS
       The per-card "Order" button was removed to declutter the deck, so
       the card itself carries the navigation. Kept as a delegated
       listener rather than an inline onclick, and it ignores clicks on
       real links inside the card so nothing is hijacked.
       ============================================================== */
    function initCardLinks() {
        var deck = $('.top-products');
        if (!deck) return;

        deck.addEventListener('click', function (ev) {
            var card = ev.target.closest('[data-href]');
            if (!card || ev.target.closest('a, button')) return;
            window.location.href = card.getAttribute('data-href');
        });

        // Keyboard users reach the product through the title anchor inside the
        // card, so no tabindex/role shim is needed here — and Swiper sets its
        // own role= on every slide, which would fight one anyway.
    }

    /* ==============================================================
       5 · HERO HEIGHT BUDGET
       The hero is capped at whatever is left of the screen below the site
       chrome, so the full banner is visible in one view. The chrome height
       is not a constant — the topbar hides at some breakpoints and the
       header resizes — so measure it rather than hard-coding it.
       ============================================================== */
    function initHeroFit() {
        var hero = $('#fhHero');
        if (!hero) return;

        // The only in-flow things above the hero (the drawer is position: fixed).
        var chrome = ['.topbar', 'header.header']
            .map(function (sel) { return $(sel); })
            .filter(Boolean);

        var last = -1;
        var settled = false;

        function measure() {
            // Sum the chrome that actually sits above the hero. Reading the
            // hero's own offsetTop instead looked simpler but was measured
            // before layout settled and came back ~150px too large, which
            // shrank the panel — so the sum is what runs until load.
            var h = 0;
            chrome.forEach(function (el) {
                var cs = window.getComputedStyle(el);
                if (cs.position === 'fixed' || cs.display === 'none') return;
                h += el.getBoundingClientRect().height;
            });

            /* Once the page HAS settled, the hero's own top IS the chrome
               height by definition, and it counts whatever the two summed
               elements miss — margins, or anything inserted between them.
               This is not circular: --fh-chrome changes the hero's HEIGHT,
               never its top. Only read it at scroll top, because the header
               is sticky and slides over the hero once the page moves. */
            if (settled && (window.pageYOffset || 0) < 2) {
                var top = hero.getBoundingClientRect().top;
                if (top > 0 && top < window.innerHeight * 0.6) h = top;
            }

            if (!h) h = 118;                         // sane default
            h = Math.round(h);
            if (h === last) return;                  // nothing to write
            last = h;
            document.documentElement.style.setProperty('--fh-chrome', h + 'px');
        }

        measure();

        /* This number is NOT stable across breakpoints — the topbar stacks on
           a phone, making the chrome 196px there against 118px on a desktop.
           Get it wrong and the hero is ~80px off for the rest of the session,
           so it is worth two triggers rather than one.

           The resize listener is the one that must always be here. RO is an
           addition, not a replacement: it also catches changes no resize
           causes (a font swap, the nav wrapping, a promo bar dismissed), but
           this codebase has already been bitten twice by renderers that
           withhold observer callbacks — see the rAF note on the slider and
           the timer fallbacks on the counters and reveals. Anything that
           depends on an observer alone is one starved renderer away from
           never running. */
        window.addEventListener('resize', function () {
            clearTimeout(measure._t);
            measure._t = setTimeout(measure, 120);
        });

        if ('ResizeObserver' in window) {
            // Held on the element so it cannot be collected while observing.
            hero._fhRO = new ResizeObserver(function () { measure(); });
            chrome.forEach(function (el) { hero._fhRO.observe(el); });
        }

        window.addEventListener('load', function () {
            settled = true;
            measure();
        });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { settled = true; measure(); });
        }
    }

    function boot() {
        initHeroFit();
        initHero();
        initCounters();
        initReveal();
        initCardLinks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();

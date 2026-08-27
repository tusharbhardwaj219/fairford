/* ==================================================================
   UPHAAR 3.0 — retailer rewards programme
   uphaar.js · pairs with css/uphaar.css
   ------------------------------------------------------------------
   Every reward figure on this page comes from RETAILER_SCHEMES below,
   which is transcribed from the "Retailer Box Scheme 2026-27" slabs in
   uphar-ki-bahar-3.0.pdf. Nothing is invented: the tiers, the reward
   carousel, the calculator and the progress meter are all views over
   that one array, so correcting a slab there corrects the whole page.
   ================================================================== */
(function () {
    'use strict';

    var $  = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    /* ==============================================================
       1 · DATA — the brochure, transcribed
       ============================================================== */
    var UPHAAR_PDF = '/uphar-ki-bahar-3.0.pdf';
    var SCHEME_VALIDITY = 'Valid till 31 March 2027';
    var SCHEME_CATEGORY = 'Retailer Offer';

    /* boxes  — the slab, as a number, so it can be compared and sorted
       gift   — the headline reward
       alt    — the alternative the retailer may choose instead (if any)
       derma  — the Dermazest 6 option for that slab
       tier   — bronze | silver | gold | platinum
       art    — key into ART below, for the illustration                */
    var RETAILER_SCHEMES = [
        { boxes: 3,   gift: '1 Kg Branded Rice',                alt: null,                                 derma: '6 PC Dermazest 6',   tier: 'bronze',   art: 'rice' },
        { boxes: 6,   gift: '2 Pc Wellspun Hand Towel Set',     alt: null,                                 derma: '12 PC Dermazest 6',  tier: 'bronze',   art: 'towel' },
        { boxes: 12,  gift: '1 Ltr. Milton Steel Bottle',       alt: 'Branded 5 Ltr. Mayur Jug',           derma: '24 PC Dermazest 6',  tier: 'bronze',   art: 'bottle' },
        { boxes: 18,  gift: 'Branded 3.5 Ltr. Steel Casserole', alt: 'Milton 6 Pc Steel Softline Tiffin',  derma: '36 PC Dermazest 6',  tier: 'bronze',   art: 'casserole' },
        { boxes: 24,  gift: 'Branded 1.8 Ltr. Electric Kettle', alt: 'Prestige Iron',                      derma: '48 PC Dermazest 6',  tier: 'bronze',   art: 'kettle' },
        { boxes: 30,  gift: '3 Pc Cello Bathroom Set',          alt: 'Branded 4 Pc Towel Set',             derma: '54 PC Dermazest 6',  tier: 'silver',   art: 'bath' },
        { boxes: 60,  gift: 'Branded 65 Cm Luggage Bag',        alt: 'Branded 15 Ltr. Steel Mayur Jug',    derma: '120 PC Dermazest 6', tier: 'silver',   art: 'luggage' },
        { boxes: 75,  gift: 'Branded 48" Ceiling Fan',          alt: 'Branded Smart Watch',                derma: '150 PC Dermazest 6', tier: 'silver',   art: 'fan' },
        { boxes: 100, gift: 'Prestige 3 Pc Non-Stick Cookware', alt: 'Branded Speaker',                    derma: '200 PC Dermazest 6', tier: 'gold',     art: 'cookware' },
        { boxes: 150, gift: 'Branded 4.2 Ltr. Air Fryer',       alt: 'Branded Ladder 4 Step',              derma: '300 PC Dermazest 6', tier: 'gold',     art: 'airfryer' },
        { boxes: 200, gift: 'Cello Copper Matka 10 Ltr.',       alt: 'Branded Office Chair',               derma: '400 PC Dermazest 6', tier: 'gold',     art: 'matka' },
        { boxes: 250, gift: 'Branded 36 Ltr. Air Cooler',       alt: 'Branded 60 Cm Chimney',              derma: '500 PC Dermazest 6', tier: 'platinum', art: 'cooler' },
        { boxes: 325, gift: 'Branded Water Dispenser',          alt: 'Branded 20 Ltr. Microwave',          derma: '650 PC Dermazest 6', tier: 'platinum', art: 'dispenser' }
    ];

    var TIERS = [
        { id: 'bronze',   name: 'Bronze',   range: '3 – 24 Boxes',    blurb: 'Where every partnership begins. Everyday household rewards on your first eligible boxes.', example: 'Branded 1.8 Ltr. Electric Kettle' },
        { id: 'silver',   name: 'Silver',   range: '30 – 75 Boxes',   blurb: 'Steady growth, better rewards. Home and lifestyle gifts as your monthly offtake builds.',   example: 'Branded 48" Ceiling Fan' },
        { id: 'gold',     name: 'Gold',     range: '100 – 200 Boxes', blurb: 'Serious volume, serious reward. Full-size kitchen and workspace appliances.',              example: 'Branded 4.2 Ltr. Air Fryer' },
        { id: 'platinum', name: 'Platinum', range: '250 – 325 Boxes', blurb: 'Our highest slab. The flagship appliances reserved for our strongest retail partners.',    example: 'Branded Water Dispenser' }
    ];

    /* Illustrations. Drawn as inline SVG on purpose — the reward gifts
       have no supplied photography, and inventing product shots for
       branded goods would misrepresent what a retailer actually receives.
       These read as line-art icons, sized and coloured by CSS.          */
    var ART = {
        rice:      '<path d="M18 26h28l-3 26a4 4 0 0 1-4 3.5H25a4 4 0 0 1-4-3.5L18 26Z"/><path d="M22 26c0-6 4-11 10-11s10 5 10 11"/><path d="M32 15c0-4 3-7 3-7s3 3 3 7"/>',
        towel:     '<rect x="14" y="20" width="36" height="26" rx="4"/><path d="M14 30h36"/><path d="M22 46v6M42 46v6"/>',
        bottle:    '<path d="M26 16h12v6l4 6v26a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V28l4-6v-6Z"/><path d="M22 34h20"/>',
        casserole: '<path d="M14 30h36v14a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V30Z"/><path d="M10 30h44"/><path d="M28 22h8v8h-8z"/>',
        kettle:    '<path d="M20 28h20a6 6 0 0 1 6 6v12a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V34a6 6 0 0 1 6-6Z"/><path d="M46 34l8-6"/><path d="M24 28l2-8h12l2 8"/>',
        bath:      '<path d="M12 34h40v8a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10v-8Z"/><path d="M20 34V20a4 4 0 0 1 8 0"/><path d="M18 52l-2 6M46 52l2 6"/>',
        luggage:   '<rect x="16" y="22" width="32" height="34" rx="4"/><path d="M26 22v-6h12v6"/><path d="M32 22v34"/><circle cx="23" cy="59" r="2.5"/><circle cx="41" cy="59" r="2.5"/>',
        fan:       '<circle cx="32" cy="32" r="5"/><path d="M32 27c0-8 4-14 10-14 4 0 6 4 4 8-2 4-8 6-14 6Z"/><path d="M37 32c8 0 14 4 14 10 0 4-4 6-8 4-4-2-6-8-6-14Z"/><path d="M27 32c0 8-4 14-10 14-4 0-6-4-4-8 2-4 8-6 14-6Z"/>',
        cookware:  '<path d="M12 32h30v10a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V32Z"/><path d="M42 36h12"/><circle cx="46" cy="24" r="6"/>',
        airfryer:  '<rect x="18" y="14" width="28" height="38" rx="6"/><rect x="22" y="38" width="20" height="12" rx="3"/><circle cx="32" cy="24" r="5"/><path d="M26 56h12"/>',
        matka:     '<path d="M24 22h16l4 10a14 14 0 0 1-24 0l4-10Z"/><path d="M22 22h20"/><path d="M28 46h8v8h-8z"/>',
        cooler:    '<rect x="16" y="12" width="32" height="42" rx="4"/><path d="M22 20h20M22 28h20"/><circle cx="32" cy="42" r="7"/><path d="M22 58h20"/>',
        dispenser: '<rect x="20" y="26" width="24" height="30" rx="3"/><path d="M26 26l2-14h8l2 14"/><path d="M28 38h8"/><path d="M24 56v4M40 56v4"/>',
        gift:      '<rect x="12" y="26" width="40" height="8" rx="2"/><path d="M32 26v30"/><path d="M48 34v18a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V34"/><path d="M22 26a6 6 0 0 1 0-12c8 0 10 12 10 12"/><path d="M42 26a6 6 0 0 0 0-12c-8 0-10 12-10 12"/>',
        cart:      '<path d="M8 12h8l6 30h26"/><path d="M22 34h26l4-16H18"/><circle cx="26" cy="52" r="4"/><circle cx="44" cy="52" r="4"/>',
        coins:     '<ellipse cx="32" cy="20" rx="16" ry="6"/><path d="M16 20v10c0 3.3 7.2 6 16 6s16-2.7 16-6V20"/><path d="M16 30v10c0 3.3 7.2 6 16 6s16-2.7 16-6V30"/><path d="M16 40v6c0 3.3 7.2 6 16 6s16-2.7 16-6v-6"/>',
        hand:      '<path d="M20 34V18a4 4 0 0 1 8 0v14"/><path d="M28 32V14a4 4 0 0 1 8 0v18"/><path d="M36 32V18a4 4 0 0 1 8 0v20"/><path d="M44 30a4 4 0 0 1 8 0v10a18 18 0 0 1-18 18h-4a14 14 0 0 1-14-14V34"/>',
        shield:    '<path d="M32 8l20 8v16c0 14-9 22-20 26-11-4-20-12-20-26V16l20-8Z"/><path d="M24 32l6 6 12-12"/>',
        headset:   '<path d="M12 36v-4a20 20 0 0 1 40 0v4"/><rect x="8" y="34" width="10" height="16" rx="4"/><rect x="46" y="34" width="10" height="16" rx="4"/><path d="M52 50v2a8 8 0 0 1-8 8h-8"/>',
        truck:     '<rect x="6" y="20" width="30" height="24" rx="3"/><path d="M36 28h10l8 8v8H36z"/><circle cx="18" cy="48" r="4"/><circle cx="44" cy="48" r="4"/>',
        map:       '<path d="M32 6c9 0 16 7 16 16 0 12-16 30-16 30S16 34 16 22c0-9 7-16 16-16Z"/><circle cx="32" cy="22" r="6"/>'
    };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function icon(key, cls) {
        return '<svg class="' + (cls || 'uh-ico') + '" viewBox="0 0 64 64" fill="none" stroke="currentColor" ' +
               'stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
               (ART[key] || ART.gift) + '</svg>';
    }

    function boxWord(n) { return n === 1 ? '1 box' : n + ' boxes'; }

    function tierOf(boxes) {
        for (var i = 0; i < RETAILER_SCHEMES.length; i++) {
            if (RETAILER_SCHEMES[i].boxes === boxes) return RETAILER_SCHEMES[i].tier;
        }
        return 'bronze';
    }

    /* The slab a retailer has actually reached, and the one after it. */
    function slabFor(boxes) {
        var reached = null, next = null;
        for (var i = 0; i < RETAILER_SCHEMES.length; i++) {
            if (RETAILER_SCHEMES[i].boxes <= boxes) reached = RETAILER_SCHEMES[i];
            else { next = RETAILER_SCHEMES[i]; break; }
        }
        return { reached: reached, next: next };
    }

    /* ==============================================================
       2 · REWARD CAROUSEL
       ============================================================== */
    function initRewards() {
        var track = $('#uhRewardTrack');
        if (!track) return;

        track.innerHTML = RETAILER_SCHEMES.slice().reverse().map(function (s) {
            var alt = s.alt ? '<p class="uh-rw__alt">or <strong>' + esc(s.alt) + '</strong></p>' : '';
            return '' +
            '<article class="uh-rw uh-rw--' + s.tier + '" tabindex="0">' +
                '<div class="uh-rw__art">' + icon(s.art, 'uh-rw__svg') +
                    '<span class="uh-rw__tier">' + esc(s.tier) + '</span>' +
                '</div>' +
                '<div class="uh-rw__body">' +
                    '<h3 class="uh-rw__name">' + esc(s.gift) + '</h3>' +
                    alt +
                    '<p class="uh-rw__req"><strong>' + s.boxes + '</strong> Boxes</p>' +
                    '<button type="button" class="uh-rw__cta" data-slab="' + s.boxes + '">' +
                        'View Reward<span aria-hidden="true">&rarr;</span></button>' +
                '</div>' +
            '</article>';
        }).join('');

        var prev = $('#uhRwPrev'), next = $('#uhRwNext');
        function step() {
            var card = $('.uh-rw', track);
            return card ? card.getBoundingClientRect().width + 20 : 320;
        }
        if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }); });
        if (next) next.addEventListener('click', function () { track.scrollBy({ left:  step(), behavior: reduced ? 'auto' : 'smooth' }); });

        function sync() {
            var max = track.scrollWidth - track.clientWidth - 2;
            if (prev) prev.disabled = track.scrollLeft <= 2;
            if (next) next.disabled = track.scrollLeft >= max;
        }
        track.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);
        sync();

        track.addEventListener('click', function (ev) {
            var b = ev.target.closest('[data-slab]');
            if (b) openSlab(parseInt(b.getAttribute('data-slab'), 10));
        });
    }

    /* ==============================================================
       3 · TIERS
       ============================================================== */
    function initTiers() {
        var wrap = $('#uhTierGrid');
        if (!wrap) return;

        wrap.innerHTML = TIERS.map(function (t, i) {
            var slabs = RETAILER_SCHEMES.filter(function (s) { return s.tier === t.id; });
            var list = slabs.map(function (s) {
                return '<li><span>' + s.boxes + ' Box</span><span>' + esc(s.gift) + '</span></li>';
            }).join('');
            return '' +
            '<article class="uh-tier uh-tier--' + t.id + ' uh-rise" style="--d:' + (i * 90) + 'ms">' +
                '<div class="uh-tier__badge" aria-hidden="true"><span>' + esc(t.name.charAt(0)) + '</span></div>' +
                '<h3 class="uh-tier__name">' + esc(t.name) + '</h3>' +
                '<p class="uh-tier__range">' + esc(t.range) + '</p>' +
                '<p class="uh-tier__blurb">' + esc(t.blurb) + '</p>' +
                '<ul class="uh-tier__list">' + list + '</ul>' +
                '<p class="uh-tier__eg"><span>Flagship reward</span><strong>' + esc(t.example) + '</strong></p>' +
            '</article>';
        }).join('');
    }

    /* ==============================================================
       4 · SLAB DETAIL MODAL
       Replaces the old scheme modal and keeps the same behaviour:
       click outside, Escape, and a brochure link inside.
       ============================================================== */
    var lastFocus = null;

    function openSlab(boxes) {
        var s = null;
        for (var i = 0; i < RETAILER_SCHEMES.length; i++) if (RETAILER_SCHEMES[i].boxes === boxes) s = RETAILER_SCHEMES[i];
        var modal = $('#uhModal'), title = $('#uhModalTitle'), body = $('#uhModalBody');
        if (!s || !modal || !body) return;

        lastFocus = document.activeElement;
        title.textContent = s.boxes + ' Box → ' + s.gift;

        var options = ['<li>' + icon(s.art, 'uh-opt__ico') + '<strong>' + esc(s.gift) + '</strong></li>'];
        if (s.alt)   options.push('<li>' + icon('gift', 'uh-opt__ico') + '<strong>' + esc(s.alt) + '</strong></li>');
        if (s.derma) options.push('<li>' + icon('gift', 'uh-opt__ico') + '<strong>' + esc(s.derma) + '</strong></li>');

        body.innerHTML = '' +
            '<p class="uh-modal__lead">Buy <strong>' + s.boxes + ' Box</strong> of eligible products and choose <strong>any one</strong> of the following:</p>' +
            '<ul class="uh-modal__opts">' + options.join('') + '</ul>' +
            '<div class="uh-modal__meta">' +
                '<div><span>Tier</span><strong>' + esc(s.tier.charAt(0).toUpperCase() + s.tier.slice(1)) + '</strong></div>' +
                '<div><span>Validity</span><strong>' + SCHEME_VALIDITY + '</strong></div>' +
                '<div><span>Category</span><strong>' + SCHEME_CATEGORY + '</strong></div>' +
            '</div>' +
            '<p class="uh-modal__note">Annual scheme applicable. Gift illustrations are representative; the actual product may differ. ' +
                'Terms &amp; conditions apply as per the brochure.</p>' +
            '<button type="button" class="uh-btn uh-btn--ghost" data-pdf>View Full Brochure (PDF)</button>';

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        var close = $('#uhModalClose');
        if (close) close.focus();
    }

    function closeSlab() {
        var modal = $('#uhModal');
        if (!modal || !modal.classList.contains('is-open')) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function initModal() {
        var modal = $('#uhModal'), close = $('#uhModalClose');
        if (close) close.addEventListener('click', closeSlab);
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeSlab(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSlab(); });
    }

    /* ==============================================================
       5 · BROCHURE
       Both actions preserved from the previous page: the hero button
       downloads the PDF, the in-page links open it in a new tab.
       ============================================================== */
    function initBrochure() {
        document.addEventListener('click', function (ev) {
            if (ev.target.closest('[data-pdf]')) {
                window.open(UPHAAR_PDF, '_blank', 'noopener');
            }
            if (ev.target.closest('[data-download]')) {
                var a = document.createElement('a');
                a.href = UPHAAR_PDF;
                a.download = 'Uphar Ki Bahar 3.0.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
    }

    /* ==============================================================
       6 · "WHAT CAN I EARN?" CALCULATOR
       Pure front end for now. Everything it needs from a backend is a
       single number — the retailer's eligible box count — so wiring it
       up later means replacing the input value and calling render().
       ============================================================== */
    function initCalculator() {
        var input = $('#uhCalcInput');
        if (!input) return;

        var out = $('#uhCalcOut');

        function render() {
            var n = parseInt(input.value, 10);
            if (isNaN(n) || n < 0) n = 0;

            var r = slabFor(n);
            var html = '';

            if (!r.reached) {
                var first = RETAILER_SCHEMES[0];
                html =
                    '<div class="uh-calc__state">' +
                        '<p class="uh-calc__none">You are <strong>' + boxWord(first.boxes - n) + '</strong> away from your first reward.</p>' +
                        '<div class="uh-calc__card">' + icon(first.art, 'uh-calc__svg') +
                            '<div><span>First reward at ' + first.boxes + ' boxes</span><strong>' + esc(first.gift) + '</strong></div>' +
                        '</div>' +
                    '</div>';
            } else {
                var nextLine = r.next
                    ? '<p class="uh-calc__next">Only <strong>' + boxWord(r.next.boxes - n) + ' more</strong> to unlock ' +
                          esc(r.next.gift) + ' at ' + r.next.boxes + ' boxes.</p>'
                    : '<p class="uh-calc__next">You have reached the <strong>highest slab</strong> in the scheme. ' +
                          'Speak to the reward team about your annual bonus.</p>';
                html =
                    '<div class="uh-calc__state">' +
                        '<p class="uh-calc__label">Your eligible reward</p>' +
                        '<div class="uh-calc__card uh-calc__card--' + r.reached.tier + '">' +
                            icon(r.reached.art, 'uh-calc__svg') +
                            '<div>' +
                                '<span>' + r.reached.boxes + ' Boxes &middot; ' +
                                    esc(r.reached.tier.charAt(0).toUpperCase() + r.reached.tier.slice(1)) + '</span>' +
                                '<strong>' + esc(r.reached.gift) + '</strong>' +
                                (r.reached.alt ? '<em>or ' + esc(r.reached.alt) + '</em>' : '') +
                            '</div>' +
                        '</div>' +
                        nextLine +
                    '</div>';
            }
            out.innerHTML = html;
        }

        input.addEventListener('input', render);
        $$('[data-calc-preset]').forEach(function (b) {
            b.addEventListener('click', function () {
                input.value = b.getAttribute('data-calc-preset');
                render();
                input.focus();
            });
        });
        render();
    }

    /* ==============================================================
       7 · JOURNEY METER
       A demonstration figure for now. Swap DEMO_BOXES for the retailer's
       real count and every number, the ring and the reward beside it
       follow — nothing else needs touching.
       ============================================================== */
    /* The brief asked for "1,850 Boxes / 150 away / 80% complete". Those three
       cannot all be true here: the Retailer Box Scheme tops out at 325 boxes,
       so 1,850 sits past the final slab and there is no next reward to be 150
       away from. 190 keeps the 80% the brief wanted and is real — it sits in
       Gold, 10 boxes short of the 200-box Cello Copper Matka.

       ONE NUMBER drives this whole section. Swap it for the retailer's own
       count when the account is wired up; every figure, the ring and the
       reward card beside it follow. */
    var DEMO_BOXES = 190;

    function initJourney() {
        var ring = $('#uhRing');
        if (!ring) return;

        // Progress within the current slab band, not against the whole scheme.
        var r = slabFor(DEMO_BOXES);
        var from = r.reached ? r.reached.boxes : 0;
        var to   = r.next ? r.next.boxes : from;
        var pct  = to > from ? Math.round(((DEMO_BOXES - from) / (to - from)) * 100) : 100;
        pct = Math.max(0, Math.min(100, pct));

        var away = r.next ? Math.max(0, r.next.boxes - DEMO_BOXES) : 0;

        var count = $('#uhJourneyCount');
        if (count) count.textContent = DEMO_BOXES.toLocaleString('en-IN');

        var pctEl = $('#uhRingPct');
        var awayEl = $('#uhJourneyAway');
        if (awayEl) {
            awayEl.innerHTML = r.next
                ? '<strong>' + boxWord(away) + '</strong> away from your next reward'
                : 'You have reached the highest slab in the scheme';
        }

        var target = $('#uhJourneyTarget');
        if (target) {
            var t = r.next || r.reached;
            target.innerHTML = t
                ? icon(t.art, 'uh-journey__svg') +
                  '<div><span>Next reward &middot; ' + t.boxes + ' Boxes</span><strong>' + esc(t.gift) + '</strong></div>'
                : '';
        }

        // The ring is a stroke-dashoffset sweep; C is its circumference.
        var C = 2 * Math.PI * 54;
        ring.style.strokeDasharray = C;
        ring.style.strokeDashoffset = C;

        function draw(to) {
            ring.style.strokeDashoffset = C - (C * to) / 100;
            if (pctEl) pctEl.textContent = Math.round(to) + '%';
        }

        if (reduced) { draw(pct); return; }

        var started = false;
        function run() {
            if (started) return;
            started = true;
            var t0 = null;
            function frame(ts) {
                if (t0 === null) t0 = ts;
                var p = Math.min(1, (ts - t0) / 1400);
                draw(pct * (1 - Math.pow(1 - p, 3)));
                if (p < 1) requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        }

        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (es) {
                if (es[0].isIntersecting) { run(); io.disconnect(); }
            }, { threshold: 0.4 });
            io.observe(ring.closest('.uh-journey__meter') || ring);
        } else { run(); }

        // Never leave an empty ring if animation frames are withheld.
        setTimeout(function () { if (!started) draw(pct); }, 4000);
    }

    /* ==============================================================
       8 · STAT COUNTERS
       ============================================================== */
    function initCounters() {
        var nums = $$('[data-count]');
        if (!nums.length) return;
        var ran = false;

        function paint(el, v) {
            var t = parseFloat(el.getAttribute('data-count'));
            el.textContent = Math.round(v).toLocaleString('en-IN') + (el.getAttribute('data-suffix') || '');
            if (v >= t) el.textContent = t.toLocaleString('en-IN') + (el.getAttribute('data-suffix') || '');
        }

        function run() {
            if (ran) return;
            ran = true;
            if (reduced) { nums.forEach(function (el) { paint(el, parseFloat(el.getAttribute('data-count'))); }); return; }
            var t0 = null;
            function frame(ts) {
                if (t0 === null) t0 = ts;
                var p = Math.min(1, (ts - t0) / 1600), e = 1 - Math.pow(1 - p, 3);
                nums.forEach(function (el) { paint(el, parseFloat(el.getAttribute('data-count')) * e); });
                if (p < 1) requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        }

        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (es) {
                if (es[0].isIntersecting) { run(); io.disconnect(); }
            }, { threshold: 0.3 });
            io.observe(nums[0].closest('.uh-stats') || nums[0]);
        } else { run(); }
        setTimeout(function () { if (!ran) run(); }, 5000);
    }

    /* ==============================================================
       9 · ACCORDION (scheme terms)
       ============================================================== */
    function initAccordion() {
        $$('.uh-acc__head').forEach(function (head) {
            head.addEventListener('click', function () {
                var item = head.closest('.uh-acc__item');
                var open = item.classList.toggle('is-open');
                head.setAttribute('aria-expanded', String(open));
                var panel = $('.uh-acc__panel', item);
                if (panel) panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '';
            });
        });
    }

    /* ==============================================================
       10 · SCHEME TABLE
       ============================================================== */
    function initTable() {
        var body = $('#uhTableBody');
        if (!body) return;
        body.innerHTML = RETAILER_SCHEMES.map(function (s) {
            return '<tr>' +
                '<td data-th="Boxes"><strong>' + s.boxes + '</strong></td>' +
                '<td data-th="Tier"><span class="uh-pill uh-pill--' + s.tier + '">' +
                    esc(s.tier.charAt(0).toUpperCase() + s.tier.slice(1)) + '</span></td>' +
                '<td data-th="Reward">' + esc(s.gift) + '</td>' +
                '<td data-th="Alternative">' + (s.alt ? esc(s.alt) : '&mdash;') + '</td>' +
                '<td data-th="Dermazest option">' + esc(s.derma) + '</td>' +
            '</tr>';
        }).join('');
    }

    /* ==============================================================
       11 · SCROLL REVEAL + PROGRESS LINE
       ============================================================== */
    function initReveal() {
        var items = $$('.uh-rise');
        if (!items.length) return;

        function revealAll() {
            items.forEach(function (el) { el.classList.add('is-in'); });
            $$('.uh-steps').forEach(function (el) { el.classList.add('is-in'); });
        }

        if (!('IntersectionObserver' in window) || reduced) { revealAll(); return; }

        var io = new IntersectionObserver(function (es) {
            es.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                /* The gold line grows with the steps. Driven by a class on the
                   list rather than a :has() selector, so it does not depend on
                   selector support to appear. */
                var steps = e.target.closest('.uh-steps');
                if (steps) steps.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
        items.forEach(function (el) { io.observe(el); });

        // .uh-rise starts at opacity 0 — never let a starved renderer
        // leave the page permanently blank.
        setTimeout(revealAll, 2600);
    }

    /* ==============================================================
       12 · CHROME — header, nav, progress, back to top
       Behaviour carried over from the previous page unchanged.
       ============================================================== */
    function initChrome() {
        var navbar = $('#navbar');
        var bar = $('#scrollProgress');
        var top = $('#backToTop');

        function onScroll() {
            var y = window.scrollY;
            if (navbar) navbar.classList.toggle('scrolled', y > 80);
            if (top) top.classList.toggle('visible', y > 600);
            if (bar) {
                var h = document.documentElement.scrollHeight - window.innerHeight;
                bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
            }
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        if (top) top.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        });

        var burger = $('#hamburger'), mob = $('#navMobile');
        if (burger && mob) {
            burger.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = mob.classList.toggle('open');
                burger.classList.toggle('open', open);
                burger.setAttribute('aria-expanded', String(open));
            });
            $$('a', mob).forEach(function (a) {
                a.addEventListener('click', function () {
                    mob.classList.remove('open');
                    burger.classList.remove('open');
                    burger.setAttribute('aria-expanded', 'false');
                });
            });
            document.addEventListener('click', function (e) {
                if (!burger.contains(e.target) && !mob.contains(e.target)) {
                    mob.classList.remove('open');
                    burger.classList.remove('open');
                    burger.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // In-page anchors, including the hero CTAs.
        document.addEventListener('click', function (ev) {
            var a = ev.target.closest('a[href^="#"], [data-goto]');
            if (!a) return;
            var sel = a.getAttribute('data-goto') || a.getAttribute('href');
            if (!sel || sel === '#') return;
            var t = document.querySelector(sel);
            if (!t) return;
            ev.preventDefault();
            t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        });
    }

    /* ==============================================================
       13 · SUPPORT ACTIONS
       Numbers and address carried over from the previous page.
       ============================================================== */
    var PHONE_DISPLAY = '9958584228';
    var PHONE_TEL = '+919958584228';
    var WHATSAPP = '919958584228';
    var EMAIL = 'info@fairfordpharma.com';
    var MAP = 'https://maps.google.com/?q=28.4089,77.0193';

    function initSupport() {
        document.addEventListener('click', function (ev) {
            var t = ev.target.closest('[data-act]');
            if (!t) return;
            var act = t.getAttribute('data-act');
            if (act === 'call') window.location.href = 'tel:' + PHONE_TEL;
            if (act === 'mail') window.location.href = 'mailto:' + EMAIL;
            if (act === 'map')  window.open(MAP, '_blank', 'noopener');
            if (act === 'wa') {
                window.open('https://wa.me/' + WHATSAPP + '?text=' +
                    encodeURIComponent('Hello! I would like help with my UPHAAR 3.0 reward claim.'),
                    '_blank', 'noopener');
            }
        });
    }

    /* ============================================================== */
    function boot() {
        initChrome();
        initRewards();
        initTiers();
        initTable();
        initModal();
        initBrochure();
        initCalculator();
        initJourney();
        initCounters();
        initAccordion();
        initSupport();
        initReveal();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();

/* ==================================================================
   UPHAAR 3.0 — retailer rewards programme
   uphaar.js · pairs with css/uphaar.css
   ------------------------------------------------------------------
   Every reward figure on this page is transcribed from the official
   "UPHAAR KI BAHAR 3.0" brochure (uphaar-ki-bahar-3.0.pdf). The
   brochure runs TWO retailer box schemes — Focus 1 and Focus 2 — each
   its own slab ladder of "buy N boxes → get this gift". Both live in
   SCHEMES below; the reward rail, the calculator, the progress meter
   and the full table are all views over the ACTIVE scheme, so a toggle
   switches every one of them at once. Nothing here is invented: the
   brochure has no "Dermazest option" and no Bronze/Silver tier system,
   so neither appears on the page.
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
    var UPHAAR_PDF = '/uphaar-ki-bahar-3.0.pdf';
    var SCHEME_VALIDITY = 'Valid 01 Sep 2026 – 31 Mar 2027';
    var SCHEME_CATEGORY = 'Retailer Offer';
    var SCHEME_STATES = 'Punjab, Haryana, Rajasthan, Gujarat, Madhya Pradesh & Chhattisgarh';

    /* boxes — the slab, as a number, so it can be compared and sorted
       gift  — the headline reward for that slab
       alt   — the "OR" alternative the retailer may choose instead (if any)
       art   — key into ART below, for the line-art illustration            */
    var FOCUS1 = [
        { boxes: 1,   gift: 'Shadani Mouth Freshener 100 GM',     alt: null,               art: 'gift' },
        { boxes: 3,   gift: '6 PC Cup Set',                       alt: null,               art: 'cup' },
        { boxes: 6,   gift: 'NC 4200 Casserole',                  alt: null,               art: 'casserole' },
        { boxes: 10,  gift: '1 Carpet',                           alt: null,               art: 'gift' },
        { boxes: 12,  gift: 'Cityware 5 Ltr. Hot & Cold',         alt: null,               art: 'dispenser' },
        { boxes: 18,  gift: '1 Ltr. Insulated Steel Bottle',      alt: 'Ubon Earbuds',     art: 'bottle' },
        { boxes: 24,  gift: '6 PC Bathroom Set',                  alt: null,               art: 'bath' },
        { boxes: 30,  gift: 'Branded 2 Burner Gas Stove',         alt: null,               art: 'stove' },
        { boxes: 45,  gift: 'Induction 1800W',                    alt: null,               art: 'stove' },
        { boxes: 60,  gift: 'Crompton Remote Fan 1200mm',         alt: null,               art: 'fan' },
        { boxes: 75,  gift: '51 PC Dinner Set (Stainless Steel)', alt: null,               art: 'cookware' },
        { boxes: 120, gift: 'Ubon Speaker Party Box with 2 Mics', alt: 'Revolving Chair',  art: 'speaker' },
        { boxes: 150, gift: 'Branded Solo Microwave 20 Ltr.',     alt: null,               art: 'microwave' },
        { boxes: 200, gift: '65 Ltr. Branded Cooler',             alt: null,               art: 'cooler' },
        { boxes: 250, gift: 'Semi-Automatic Washing Machine 7KG', alt: null,               art: 'washer' },
        { boxes: 300, gift: 'Branded LED 32"',                    alt: null,               art: 'tv' },
        { boxes: 400, gift: 'Refrigerator Double Door 215 Ltr.',  alt: 'Branded LED 43"',  art: 'fridge' }
    ];

    var FOCUS2 = [
        { boxes: 1,   gift: '1 Kg Rice',                          alt: null,               art: 'rice' },
        { boxes: 3,   gift: '6 PC Cup & Saucer Set',              alt: null,               art: 'cup' },
        { boxes: 5,   gift: 'Leather Duffle Bag',                 alt: null,               art: 'luggage' },
        { boxes: 10,  gift: 'Copper Bottle & 2 Gallon',          alt: null,               art: 'bottle' },
        { boxes: 20,  gift: 'Double Bedsheet + Comforter',        alt: null,               art: 'bed' },
        { boxes: 24,  gift: 'Branded Mixer Grinder',              alt: null,               art: 'mixer' },
        { boxes: 30,  gift: 'Cello Copper Matka 5 Ltr. & 2 Gallon', alt: null,             art: 'matka' },
        { boxes: 40,  gift: '1 Cabin Trolley Bag + 1 Medium (Branded)', alt: null,         art: 'luggage' },
        { boxes: 50,  gift: 'Branded Vacuum Cleaner',            alt: null,               art: 'gift' },
        { boxes: 60,  gift: 'Branded 16 Ltr. Locker',            alt: null,               art: 'shield' },
        { boxes: 80,  gift: 'Sujata Mixer Grinder',              alt: null,               art: 'mixer' },
        { boxes: 100, gift: 'Branded Water Dispenser',           alt: null,               art: 'dispenser' },
        { boxes: 130, gift: 'Branded Atta Chakki',               alt: null,               art: 'gift' }
    ];

    var SCHEMES = {
        focus1: {
            id: 'focus1', name: 'Focus 1 Products Box Scheme', short: 'Focus 1',
            blurb: 'Everyday-to-flagship rewards across the Focus 1 range — from a first-box thank-you to a double-door refrigerator.',
            slabs: FOCUS1
        },
        focus2: {
            id: 'focus2', name: 'Focus 2 Products Box Scheme', short: 'Focus 2',
            blurb: 'A second reward track for the Focus 2 range — kitchenware, luggage and home appliances as your offtake grows.',
            slabs: FOCUS2
        }
    };
    var SCHEME_ORDER = ['focus1', 'focus2'];
    var activeScheme = 'focus1';
    function scheme() { return SCHEMES[activeScheme]; }
    function slabs() { return scheme().slabs; }

    /* Illustrations. Drawn as inline SVG on purpose — the reward gifts
       have no supplied photography, and inventing product shots for
       branded goods would misrepresent what a retailer actually receives.
       These read as line-art icons, sized and coloured by CSS.          */
    var ART = {
        rice:      '<path d="M18 26h28l-3 26a4 4 0 0 1-4 3.5H25a4 4 0 0 1-4-3.5L18 26Z"/><path d="M22 26c0-6 4-11 10-11s10 5 10 11"/><path d="M32 15c0-4 3-7 3-7s3 3 3 7"/>',
        bottle:    '<path d="M26 16h12v6l4 6v26a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V28l4-6v-6Z"/><path d="M22 34h20"/>',
        casserole: '<path d="M14 30h36v14a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V30Z"/><path d="M10 30h44"/><path d="M28 22h8v8h-8z"/>',
        bath:      '<path d="M12 34h40v8a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10v-8Z"/><path d="M20 34V20a4 4 0 0 1 8 0"/><path d="M18 52l-2 6M46 52l2 6"/>',
        luggage:   '<rect x="16" y="22" width="32" height="34" rx="4"/><path d="M26 22v-6h12v6"/><path d="M32 22v34"/><circle cx="23" cy="59" r="2.5"/><circle cx="41" cy="59" r="2.5"/>',
        fan:       '<circle cx="32" cy="32" r="5"/><path d="M32 27c0-8 4-14 10-14 4 0 6 4 4 8-2 4-8 6-14 6Z"/><path d="M37 32c8 0 14 4 14 10 0 4-4 6-8 4-4-2-6-8-6-14Z"/><path d="M27 32c0 8-4 14-10 14-4 0-6-4-4-8 2-4 8-6 14-6Z"/>',
        cookware:  '<path d="M12 32h30v10a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V32Z"/><path d="M42 36h12"/><circle cx="46" cy="24" r="6"/>',
        matka:     '<path d="M24 22h16l4 10a14 14 0 0 1-24 0l4-10Z"/><path d="M22 22h20"/><path d="M28 46h8v8h-8z"/>',
        cooler:    '<rect x="16" y="12" width="32" height="42" rx="4"/><path d="M22 20h20M22 28h20"/><circle cx="32" cy="42" r="7"/><path d="M22 58h20"/>',
        dispenser: '<rect x="20" y="26" width="24" height="30" rx="3"/><path d="M26 26l2-14h8l2 14"/><path d="M28 38h8"/><path d="M24 56v4M40 56v4"/>',
        /* new gifts introduced by the UPHAAR KI BAHAR 3.0 brochure */
        cup:       '<path d="M18 24h22v13a11 11 0 0 1-22 0V24Z"/><path d="M40 27h5a5 5 0 0 1 0 10h-5"/><path d="M18 52h22"/>',
        stove:     '<rect x="12" y="26" width="40" height="20" rx="3"/><circle cx="24" cy="36" r="5"/><circle cx="40" cy="36" r="5"/><path d="M18 46v6M46 46v6"/>',
        speaker:   '<rect x="22" y="10" width="20" height="44" rx="4"/><circle cx="32" cy="23" r="3.5"/><circle cx="32" cy="40" r="6"/>',
        microwave: '<rect x="8" y="18" width="48" height="28" rx="3"/><rect x="13" y="23" width="24" height="18" rx="2"/><path d="M45 24v4M45 32v4"/>',
        washer:    '<rect x="16" y="10" width="32" height="46" rx="4"/><circle cx="32" cy="36" r="11"/><circle cx="32" cy="36" r="4"/><path d="M22 18h6"/>',
        tv:        '<rect x="8" y="14" width="48" height="30" rx="3"/><path d="M24 52h16M32 44v8"/>',
        fridge:    '<rect x="20" y="8" width="24" height="48" rx="4"/><path d="M20 26h24"/><path d="M26 16v5M26 31v7"/>',
        bed:       '<path d="M8 30v18M8 40h48v8M56 34v14"/><path d="M12 40v-6a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4v6"/>',
        mixer:     '<path d="M24 12h16l-2 15H26L24 12Z"/><path d="M28 27v9a4 4 0 0 0 8 0v-9"/><rect x="21" y="46" width="22" height="10" rx="2"/>',
        gift:      '<rect x="12" y="26" width="40" height="8" rx="2"/><path d="M32 26v30"/><path d="M48 34v18a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V34"/><path d="M22 26a6 6 0 0 1 0-12c8 0 10 12 10 12"/><path d="M42 26a6 6 0 0 0 0-12c-8 0-10 12-10 12"/>',
        cart:      '<path d="M8 12h8l6 30h26"/><path d="M22 34h26l4-16H18"/><circle cx="26" cy="52" r="4"/><circle cx="44" cy="52" r="4"/>',
        coins:     '<ellipse cx="32" cy="20" rx="16" ry="6"/><path d="M16 20v10c0 3.3 7.2 6 16 6s16-2.7 16-6V20"/><path d="M16 30v10c0 3.3 7.2 6 16 6s16-2.7 16-6V30"/><path d="M16 40v6c0 3.3 7.2 6 16 6s16-2.7 16-6v-6"/>',
        shield:    '<path d="M32 8l20 8v16c0 14-9 22-20 26-11-4-20-12-20-26V16l20-8Z"/><path d="M24 32l6 6 12-12"/>'
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

    /* A purely cosmetic accent band (bronze→platinum) by the slab's position
       within its ladder, so the rail keeps its premium metallic variety. It is
       NOT a claimed tier — the brochure defines none. */
    var BANDS = ['bronze', 'silver', 'gold', 'platinum'];
    function bandOf(index, total) {
        if (total <= 1) return 'gold';
        return BANDS[Math.min(BANDS.length - 1, Math.floor((index / total) * BANDS.length))];
    }

    /* The slab a retailer has actually reached in the ACTIVE scheme, and the
       one after it. */
    function slabFor(boxes) {
        var list = slabs(), reached = null, next = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].boxes <= boxes) reached = list[i];
            else { next = list[i]; break; }
        }
        return { reached: reached, next: next };
    }

    /* ==============================================================
       2 · SCHEME TOGGLE  (Focus 1 / Focus 2)
       Switches every scheme-driven view at once.
       ============================================================== */
    function renderToggle(host) {
        if (!host) return;
        host.classList.add('uh-switch');
        host.setAttribute('role', 'tablist');
        host.setAttribute('aria-label', 'Choose a reward scheme');
        host.innerHTML = SCHEME_ORDER.map(function (id) {
            var s = SCHEMES[id], on = id === activeScheme;
            return '<button type="button" role="tab" class="uh-switch__btn' + (on ? ' is-on' : '') + '" ' +
                'data-scheme="' + id + '" aria-selected="' + on + '">' +
                '<span class="uh-switch__name">' + esc(s.short) + '</span>' +
                '<span class="uh-switch__meta">' + s.slabs.length + ' rewards</span>' +
                '</button>';
        }).join('');
    }

    function setScheme(id) {
        if (!SCHEMES[id] || id === activeScheme) return;
        activeScheme = id;
        refreshScheme();
    }

    /* Rebuilds every scheme-dependent surface + syncs the toggles/captions. */
    function refreshScheme() {
        $$('#uhSchemeToggle, #uhSchemeToggle2').forEach(renderToggle);
        renderRewardTrack();
        renderTable();
        renderCalc();
        renderJourney();

        var s = scheme();
        var sub = $('#uhRewardsSub');
        if (sub) sub.textContent = s.name + ' — ' + s.slabs.length + ' rewards, highest slab first.';
        var cap = $('#uhTableCaption');
        if (cap) cap.textContent = s.name + ' — all ' + s.slabs.length + ' slabs. Choose the reward (or its alternative where offered).';
    }

    function initToggle() {
        document.addEventListener('click', function (ev) {
            var b = ev.target.closest('[data-scheme]');
            if (b) setScheme(b.getAttribute('data-scheme'));
        });
    }

    /* ==============================================================
       3 · REWARD CAROUSEL
       ============================================================== */
    function renderRewardTrack() {
        var track = $('#uhRewardTrack');
        if (!track) return;
        var list = slabs(), total = list.length;
        track.innerHTML = list.slice().reverse().map(function (s, ri) {
            var i = total - 1 - ri;                 // original ascending index
            var band = bandOf(i, total);
            var alt = s.alt ? '<p class="uh-rw__alt">or <strong>' + esc(s.alt) + '</strong></p>' : '';
            return '' +
            '<article class="uh-rw uh-rw--' + band + '" tabindex="0">' +
                '<div class="uh-rw__art">' + icon(s.art, 'uh-rw__svg') +
                    '<span class="uh-rw__tier">' + esc(scheme().short) + '</span>' +
                '</div>' +
                '<div class="uh-rw__body">' +
                    '<h3 class="uh-rw__name">' + esc(s.gift) + '</h3>' +
                    alt +
                    '<p class="uh-rw__req"><strong>' + s.boxes + '</strong> ' + (s.boxes === 1 ? 'Box' : 'Boxes') + '</p>' +
                    '<button type="button" class="uh-rw__cta" data-slab="' + s.boxes + '">' +
                        'View Reward<span aria-hidden="true">&rarr;</span></button>' +
                '</div>' +
            '</article>';
        }).join('');
        syncRailArrows();
    }

    var _railSync = null;
    function syncRailArrows() { if (_railSync) _railSync(); }

    function initRewards() {
        var track = $('#uhRewardTrack');
        if (!track) return;

        var prev = $('#uhRwPrev'), next = $('#uhRwNext');
        function step() {
            var card = $('.uh-rw', track);
            return card ? card.getBoundingClientRect().width + 20 : 320;
        }
        if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }); });
        if (next) next.addEventListener('click', function () { track.scrollBy({ left:  step(), behavior: reduced ? 'auto' : 'smooth' }); });

        _railSync = function () {
            var max = track.scrollWidth - track.clientWidth - 2;
            if (prev) prev.disabled = track.scrollLeft <= 2;
            if (next) next.disabled = track.scrollLeft >= max;
        };
        track.addEventListener('scroll', _railSync, { passive: true });
        window.addEventListener('resize', _railSync);

        track.addEventListener('click', function (ev) {
            var b = ev.target.closest('[data-slab]');
            if (b) openSlab(parseInt(b.getAttribute('data-slab'), 10));
        });

        renderRewardTrack();
    }

    /* ==============================================================
       4 · SCHEME OVERVIEW CARDS  (was "Reward Tiers")
       The brochure has no Bronze→Platinum tiers; it has two schemes.
       This section now presents those two tracks at a glance.
       ============================================================== */
    function initTiers() {
        var wrap = $('#uhTierGrid');
        if (!wrap) return;

        wrap.innerHTML = SCHEME_ORDER.map(function (id, i) {
            var s = SCHEMES[id];
            var top = s.slabs[s.slabs.length - 1];
            var lo = s.slabs[0].boxes, hi = top.boxes;
            var band = i === 0 ? 'gold' : 'platinum';
            /* three representative rungs: first, a middle one, and the top */
            var mid = s.slabs[Math.floor(s.slabs.length / 2)];
            var picks = [s.slabs[0], mid, top];
            var list = picks.map(function (p) {
                return '<li><span>' + p.boxes + ' Box</span><span>' + esc(p.gift) + '</span></li>';
            }).join('');
            return '' +
            '<article class="uh-tier uh-tier--' + band + ' uh-rise" style="--d:' + (i * 90) + 'ms">' +
                '<div class="uh-tier__badge" aria-hidden="true"><span>' + (i + 1) + '</span></div>' +
                '<h3 class="uh-tier__name">' + esc(s.short) + '</h3>' +
                '<p class="uh-tier__range">' + lo + ' – ' + hi + ' Boxes &middot; ' + s.slabs.length + ' rewards</p>' +
                '<p class="uh-tier__blurb">' + esc(s.blurb) + '</p>' +
                '<ul class="uh-tier__list">' + list + '</ul>' +
                '<p class="uh-tier__eg"><span>Flagship reward</span><strong>' + esc(top.gift) + '</strong></p>' +
                '<button type="button" class="uh-btn uh-btn--ghost uh-tier__cta" data-scheme="' + id + '" data-goto="#rewards">' +
                    'See ' + esc(s.short) + ' rewards <span aria-hidden="true">&rarr;</span></button>' +
            '</article>';
        }).join('');
    }

    /* ==============================================================
       5 · SLAB DETAIL MODAL
       ============================================================== */
    var lastFocus = null;

    function openSlab(boxes) {
        var list = slabs(), s = null;
        for (var i = 0; i < list.length; i++) if (list[i].boxes === boxes) s = list[i];
        var modal = $('#uhModal'), title = $('#uhModalTitle'), body = $('#uhModalBody');
        if (!s || !modal || !body) return;

        lastFocus = document.activeElement;
        title.textContent = s.boxes + ' Box → ' + s.gift;

        var options = ['<li>' + icon(s.art, 'uh-opt__ico') + '<strong>' + esc(s.gift) + '</strong></li>'];
        if (s.alt) options.push('<li>' + icon('gift', 'uh-opt__ico') + '<strong>' + esc(s.alt) + '</strong></li>');

        var choose = s.alt
            ? 'Buy <strong>' + s.boxes + ' Box</strong> of eligible ' + esc(scheme().short) + ' products and choose <strong>any one</strong> of the following:'
            : 'Buy <strong>' + s.boxes + ' Box</strong> of eligible ' + esc(scheme().short) + ' products and receive:';

        body.innerHTML = '' +
            '<p class="uh-modal__lead">' + choose + '</p>' +
            '<ul class="uh-modal__opts">' + options.join('') + '</ul>' +
            '<div class="uh-modal__meta">' +
                '<div><span>Scheme</span><strong>' + esc(scheme().short) + '</strong></div>' +
                '<div><span>Validity</span><strong>' + esc(SCHEME_VALIDITY) + '</strong></div>' +
                '<div><span>Category</span><strong>' + esc(SCHEME_CATEGORY) + '</strong></div>' +
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
       6 · BROCHURE  (hero + in-page buttons download / open the PDF)
       ============================================================== */
    function initBrochure() {
        document.addEventListener('click', function (ev) {
            if (ev.target.closest('[data-pdf]')) {
                window.open(UPHAAR_PDF, '_blank', 'noopener');
            }
            if (ev.target.closest('[data-download]')) {
                var a = document.createElement('a');
                a.href = UPHAAR_PDF;
                a.download = 'Uphaar Ki Bahar 3.0.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
    }

    /* ==============================================================
       7 · "WHAT CAN I EARN?" CALCULATOR
       ============================================================== */
    var _calcInput = null;
    function renderCalc() {
        var input = _calcInput, out = $('#uhCalcOut');
        if (!input || !out) return;
        var n = parseInt(input.value, 10);
        if (isNaN(n) || n < 0) n = 0;

        var r = slabFor(n);
        var list = slabs();
        var html = '';

        if (!r.reached) {
            var first = list[0];
            html =
                '<div class="uh-calc__state">' +
                    '<p class="uh-calc__none">You are <strong>' + boxWord(first.boxes - n) + '</strong> away from your first ' + esc(scheme().short) + ' reward.</p>' +
                    '<div class="uh-calc__card">' + icon(first.art, 'uh-calc__svg') +
                        '<div><span>First reward at ' + boxWord(first.boxes) + '</span><strong>' + esc(first.gift) + '</strong></div>' +
                    '</div>' +
                '</div>';
        } else {
            var nextLine = r.next
                ? '<p class="uh-calc__next">Only <strong>' + boxWord(r.next.boxes - n) + ' more</strong> to unlock ' +
                      esc(r.next.gift) + ' at ' + r.next.boxes + ' boxes.</p>'
                : '<p class="uh-calc__next">You have reached the <strong>highest slab</strong> in ' + esc(scheme().name) + '. ' +
                      'Speak to the reward team about your annual bonus.</p>';
            html =
                '<div class="uh-calc__state">' +
                    '<p class="uh-calc__label">Your eligible reward &middot; ' + esc(scheme().short) + '</p>' +
                    '<div class="uh-calc__card uh-calc__card--gold">' +
                        icon(r.reached.art, 'uh-calc__svg') +
                        '<div>' +
                            '<span>' + r.reached.boxes + ' Boxes</span>' +
                            '<strong>' + esc(r.reached.gift) + '</strong>' +
                            (r.reached.alt ? '<em>or ' + esc(r.reached.alt) + '</em>' : '') +
                        '</div>' +
                    '</div>' +
                    nextLine +
                '</div>';
        }
        out.innerHTML = html;
    }

    function initCalculator() {
        _calcInput = $('#uhCalcInput');
        if (!_calcInput) return;
        _calcInput.addEventListener('input', renderCalc);
        $$('[data-calc-preset]').forEach(function (b) {
            b.addEventListener('click', function () {
                _calcInput.value = b.getAttribute('data-calc-preset');
                renderCalc();
                _calcInput.focus();
            });
        });
        renderCalc();
    }

    /* ==============================================================
       8 · JOURNEY METER
       ONE number drives this section. Swap DEMO_BOXES for the retailer's
       real count when the account is wired up.
       ============================================================== */
    /* Must sit BETWEEN slabs (never exactly on one) or the "progress within the
       current band" ring reads 0%. 110 gives real partial progress in BOTH
       ladders — Focus 1: 75→120 band ≈ 78%; Focus 2: 100→130 band ≈ 33%. */
    var DEMO_BOXES = 110;

    function renderJourney() {
        var ring = $('#uhRing');
        if (!ring) return;

        var r = slabFor(DEMO_BOXES);
        var from = r.reached ? r.reached.boxes : 0;
        var to   = r.next ? r.next.boxes : from;
        var pct  = to > from ? Math.round(((DEMO_BOXES - from) / (to - from)) * 100) : 100;
        pct = Math.max(0, Math.min(100, pct));
        var away = r.next ? Math.max(0, r.next.boxes - DEMO_BOXES) : 0;

        var count = $('#uhJourneyCount');
        if (count) count.textContent = DEMO_BOXES.toLocaleString('en-IN');

        var awayEl = $('#uhJourneyAway');
        if (awayEl) {
            awayEl.innerHTML = r.next
                ? '<strong>' + boxWord(away) + '</strong> away from your next ' + esc(scheme().short) + ' reward'
                : 'You have reached the highest slab in ' + esc(scheme().short);
        }

        var target = $('#uhJourneyTarget');
        if (target) {
            var t = r.next || r.reached;
            target.innerHTML = t
                ? icon(t.art, 'uh-journey__svg') +
                  '<div><span>Next reward &middot; ' + t.boxes + ' Boxes</span><strong>' + esc(t.gift) + '</strong></div>'
                : '';
        }

        var C = 2 * Math.PI * 54;
        ring.style.strokeDasharray = C;
        var pctEl = $('#uhRingPct');
        // On a scheme switch we redraw instantly; the intro animation is handled
        // once by initJourney().
        if (ring.dataset.animated === '1') {
            ring.style.strokeDashoffset = C - (C * pct) / 100;
            if (pctEl) pctEl.textContent = pct + '%';
        }
        ring._targetPct = pct;
    }

    function initJourney() {
        var ring = $('#uhRing');
        if (!ring) return;
        renderJourney();

        var C = 2 * Math.PI * 54;
        var pctEl = $('#uhRingPct');
        ring.style.strokeDasharray = C;
        ring.style.strokeDashoffset = C;

        function draw(v) {
            ring.style.strokeDashoffset = C - (C * v) / 100;
            if (pctEl) pctEl.textContent = Math.round(v) + '%';
        }

        function finalPct() { return ring._targetPct || 0; }

        if (reduced) { ring.dataset.animated = '1'; draw(finalPct()); return; }

        var started = false;
        function run() {
            if (started) return;
            started = true;
            ring.dataset.animated = '1';
            var t0 = null, target = finalPct();
            function frame(ts) {
                if (t0 === null) t0 = ts;
                var p = Math.min(1, (ts - t0) / 1400);
                draw(target * (1 - Math.pow(1 - p, 3)));
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

        setTimeout(function () { if (!started) { ring.dataset.animated = '1'; draw(finalPct()); } }, 4000);
    }

    /* ==============================================================
       9 · STAT COUNTERS
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
       10 · ACCORDION (scheme terms)
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
       11 · SCHEME TABLE
       ============================================================== */
    function renderTable() {
        var body = $('#uhTableBody');
        if (!body) return;
        body.innerHTML = slabs().map(function (s) {
            return '<tr>' +
                '<td data-th="Boxes"><strong>' + s.boxes + '</strong></td>' +
                '<td data-th="Reward">' + esc(s.gift) + '</td>' +
                '<td data-th="Alternative">' + (s.alt ? esc(s.alt) : '&mdash;') + '</td>' +
            '</tr>';
        }).join('');
    }

    /* ==============================================================
       12 · SCROLL REVEAL + PROGRESS LINE
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
                var steps = e.target.closest('.uh-steps');
                if (steps) steps.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
        items.forEach(function (el) { io.observe(el); });

        setTimeout(revealAll, 2600);
    }

    /* ==============================================================
       13 · CHROME — header, nav, progress, back to top
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

        // In-page anchors, including the hero CTAs and the scheme-card links.
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
       14 · SUPPORT ACTIONS
       ============================================================== */
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
        initToggle();
        $$('#uhSchemeToggle, #uhSchemeToggle2').forEach(renderToggle);
        initRewards();
        initTiers();
        renderTable();
        initModal();
        initBrochure();
        initCalculator();
        initJourney();
        initCounters();
        initAccordion();
        initSupport();
        initReveal();
        // Sync captions to the default scheme.
        var s = scheme();
        var sub = $('#uhRewardsSub'); if (sub) sub.textContent = s.name + ' — ' + s.slabs.length + ' rewards, highest slab first.';
        var cap = $('#uhTableCaption'); if (cap) cap.textContent = s.name + ' — all ' + s.slabs.length + ' slabs. Choose the reward (or its alternative where offered).';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();

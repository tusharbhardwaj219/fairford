/* ==================================================================
   NUEVA VIDA — flagship brand page
   nueva-vida.js  ·  pairs with css/nueva-vida.css + public/nueva-vida.html
   ------------------------------------------------------------------
   Vanilla JS, no dependencies, no build step.

   Everything the page renders comes from NV_DATA below — add a product
   or an extra pack shot there and the showcases, the card grid and the
   360 viewer all pick it up automatically.

   Product copy is taken from the printed pack labels. Do not add health
   claims that are not on the pack.
   ================================================================== */
(function () {
    'use strict';

    /* ==============================================================
       1 · DATA
       Cloudinary URLs are used exactly as supplied — never re-encoded,
       resized or substituted.
       ============================================================== */

    var IMG = {
        hero: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131621/ChatGPT_Image_Aug_19_2026_02_12_14_PM_baxvww.png',

        womenFront: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131256/WOMEN_FRONT_iuk8v1.jpg',
        // NOTE: the URL supplied for the WOMEN back panel is the same asset as
        // the front. Identical URLs are de-duplicated at render time (see
        // buildGallery) so the slider does not sit on a repeated frame.
        // Drop the real back-panel URL in here and it becomes a second slide.
        womenBack: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131256/WOMEN_FRONT_iuk8v1.jpg',

        menFront: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131257/MEN_FRONT_cx4lzl.jpg',
        menBack: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131261/MEN_BACK_yltzbe.jpg',

        magFront: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131260/MAGNESIUM_FRONT_gw8sz5.jpg',
        magBack: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131257/MAGNESIUM_BACK_kpdto1.jpg',

        omegaFront: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131256/VEGOMEGA_FRONT_rg8kwp.jpg',
        omegaBack: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131256/VEGOMEGA_BACK_rpcavn.jpg',

        // --- VEG OMEGA turntable ---
        // Four real photographs, 90 degrees apart, listed in rotational order:
        // front -> quarter turn right -> back -> quarter turn left -> (wraps).
        // Order was read off the photographs themselves: in spin90 a sliver of
        // the front label is leaving the RIGHT edge, in spin270 it is leaving the
        // LEFT edge, so dragging right walks the array forwards.
        omegaSpin0:   'https://res.cloudinary.com/dp4yririh/image/upload/v1787135854/ChatGPT_Image_Aug_19_2026_04_02_10_PM_oos3lh.png',
        omegaSpin90:  'https://res.cloudinary.com/dp4yririh/image/upload/v1787135856/ChatGPT_Image_Aug_19_2026_04_01_31_PM_h0w2ec.png',
        omegaSpin180: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787135856/ChatGPT_Image_Aug_19_2026_04_01_36_PM_ovedxf.png',
        omegaSpin270: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787135855/ChatGPT_Image_Aug_19_2026_04_01_44_PM_kagrde.png',
        // Different axis to the turntable — offered as separate views.
        omegaTop:     'https://res.cloudinary.com/dp4yririh/image/upload/v1787135857/ChatGPT_Image_Aug_19_2026_04_01_25_PM_fyqd82.png',
        omegaBase:    'https://res.cloudinary.com/dp4yririh/image/upload/v1787135861/ChatGPT_Image_Aug_19_2026_04_01_04_PM_namk6e.png',

        /* --- Category posters ---
           One per category, shown in the "Our Product Categories" section and
           nowhere else. All four are 1024x1536 (2:3 portrait), which is why
           .nv-show__shot is a 2:3 box: the poster fills it exactly, so there
           is no crop and no letterbox strip.

           These are NOT the studio pack shots in the fields above. They are
           finished posters with their own headline, benefit list and footer
           strip running to all four edges, so they must never be cropped and
           must never get mix-blend-mode: multiply (that is for pack shots on
           a white card; these carry full-colour backgrounds). The pack shots
           are still what the card grid and the 360 viewer use. */
        catWomen:     'https://res.cloudinary.com/dp4yririh/image/upload/v1787372717/ChatGPT_Image_Aug_21_2026_05_27_32_PM_qcolva.png',
        catMen:       'https://res.cloudinary.com/dp4yririh/image/upload/v1787372723/ChatGPT_Image_Aug_21_2026_05_19_20_PM_oqdqee.png',
        catOmega:     'https://res.cloudinary.com/dp4yririh/image/upload/v1787372717/ChatGPT_Image_Aug_21_2026_05_24_37_PM_fqwkp1.png',
        catMagnesium: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787372727/ChatGPT_Image_Aug_21_2026_05_33_12_PM_aedo6t.png'
    };

    /* --------------------------------------------------------------
       HERO SLIDER — the four banners, in order.

       This is the only place to touch. Swap an `image`, reorder the
       array, or add a fifth entry, and the slider rebuilds itself.

       Every text field is OPTIONAL. Leave eyebrow/title/description/cta
       empty and the slide renders as artwork alone; fill any of them in
       and a text panel fades up over that slide, styled and positioned
       by `align` ('left' | 'center') and `tone` ('light' | 'dark').

       They are empty here on purpose. All four supplied banners are
       fully composed: each one already carries its own eyebrow, headline,
       description, benefit row and CTA button as part of the artwork, and
       there is no clear area left to place an HTML panel without printing
       text on top of text. If a future banner is shot with open space,
       fill these in and the overlay appears with no other change.

       `alt` is what a screen reader gets, so it carries the wording that
       is baked into the picture.

       `field` is optional and only matters when a banner is NOT 3:2 like
       the rest. The stage is 3:2, so an off-ratio image is letterboxed
       rather than cropped, and `field` paints the leftover strip in that
       banner's own edge colours instead of leaving bare stage behind it.
       Two layers, each half the stage and anchored to one edge, so the
       top strip is painted from the artwork's top row and the bottom
       strip from its bottom row. The colours are MEASURED, not chosen —
       sample the outer 6px at six points across each edge. Omit it for a
       3:2 banner: it fills the stage exactly and nothing shows through.
       -------------------------------------------------------------- */
    var NV_HERO_SLIDES = [
        {
            image: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787131621/ChatGPT_Image_Aug_19_2026_02_12_14_PM_baxvww.png',
            alt: 'NUEVA VIDA — Stronger You. Better Everyday. Premium nutrition for a stronger, healthier you. The complete range: Women, Magnesium Glycine Tablets, Men and Veg Omega.',
            eyebrow: '', title: 'NUEVA VIDA', description: '', cta: '', href: '',
            align: 'left', tone: 'dark'
        },
        {
            image: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787311047/ChatGPT_Image_Aug_21_2026_04_46_58_PM_pc5kpw.png',
            alt: 'NUEVA VIDA MEN — Fuel Your Strength. Power Your Life. Daily wellness support designed for men who strive for strength, performance, and a healthier tomorrow. Strong muscles, immunity support, stamina and energy, overall wellness.',
            eyebrow: '', title: 'NUEVA VIDA MEN', description: '', cta: '', href: '',
            align: 'left', tone: 'light',
            /* 1717x916 (1.874), the one banner that is not 3:2, so it sits
               10% short of the stage top and bottom. Its edges are almost
               black — left as bare stage it would read as two pale bars
               across a dark gym shot. Measured from its own edge rows. */
            field:
                'linear-gradient(90deg,#0d0d0d 8%,#111314 25%,#2e2e2c 42%,#2c2b29 58%,#040507 75%,#090c0e 92%) bottom / 100% 50% no-repeat,' +
                'linear-gradient(90deg,#342517 8%,#090c0e 25%,#090d0f 42%,#0e1215 58%,#0b0f12 75%,#0a0e11 92%) top / 100% 50% no-repeat'
        },
        {
            image: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787307851/ChatGPT_Image_Aug_20_2026_04_08_54_PM_e25gmg.png',
            alt: 'NUEVA VIDA VEG OMEGA 3, 6, 7 and 9 — the complete plant-based omega blend from flax seed, black seed and sea buckthorn, for heart, brain and joint support.',
            eyebrow: '', title: 'NUEVA VIDA VEG OMEGA', description: '', cta: '', href: '',
            align: 'left', tone: 'light'
        },
        {
            image: 'https://res.cloudinary.com/dp4yririh/image/upload/v1787296219/ChatGPT_Image_Aug_21_2026_12_29_10_PM_pmvalr.png',
            alt: 'NUEVA VIDA Magnesium Glycine Tablets — Strong Bones. Powerful You. Formulated to support bone density, energy production and muscle health.',
            eyebrow: '', title: 'NUEVA VIDA MAGNESIUM GLYCINE', description: '', cta: '', href: '',
            align: 'left', tone: 'dark'
        }
    ];

    var NV_DATA = {
        hero: {
            src: IMG.hero,
            alt: 'NUEVA VIDA — Stronger You. Better Everyday. The complete range: Women, Magnesium Glycine Tablets, Men and Veg Omega.'
        },

        /* Each product:
             pill / tint  — pack colour used for accents only
             claim        — the line printed on the front of the pack
             images       — [{ src, label }] ; first entry drives the card + hero frame
             frames360    — optional array of real turntable frames. With 4 or
                            more the viewer switches to true frame rotation;
                            otherwise it rotates the front/back faces in 3D.   */
        products: [
        {
            id: 'women',
            // Shown ONLY in the Our Product Categories showcase. 2:3 poster.
            poster: { src: IMG.catWomen, alt: "NUEVA VIDA WOMEN — Nourish Your Strength. Radiate Health. Live Confident. Daily nutrition for a stronger body, healthy bones and inner glow: immunity support, strong bones, healthy skin, hormonal balance, energy and stamina." },
            name: 'NUEVA VIDA WOMEN',
            category: 'Daily Multivitamin for Women',
            pill: '#B01E62',
            tint: 'rgba(176, 30, 98, .12)',
            claim: 'Supports Overall Health, Radiance, Strong Bones & Immunity',
            copy: 'A daily multivitamin built around the way a woman actually lives — long days, ' +
                  'shifting energy, and not much patience for complicated routines. One film-coated ' +
                  'tablet, once a day, as a steady nutritional foundation underneath everything else.',
            highlights: [
                'One tablet a day — an easy, repeatable daily ritual',
                'Formulated for radiance, strong bones and everyday immunity',
                'Film-coated for a smooth, easy swallow',
                'Vegetarian · green-dot certified nutraceutical'
            ],
            specs: [
                { k: 'Pack', v: '60 Tablets' },
                { k: 'Form', v: 'Film-coated tablet' },
                { k: 'Category', v: 'Nutraceutical' },
                { k: 'Diet', v: 'Vegetarian' }
            ],
            facts: [
                { k: 'Pack size', v: '60 Tablets' },
                { k: 'Format', v: 'Film-coated tablet' },
                { k: 'Classification', v: 'Nutraceutical' },
                { k: 'Suitable for', v: 'Daily use' }
            ],
            note: 'Detailed nutritional information is printed on the pack. ' +
                  'Consume as directed by your dietician.',
            images: [
                { src: IMG.womenFront, label: 'Front' },
                { src: IMG.womenBack, label: 'Back' }
            ],
            frames360: []
        },
        {
            id: 'men',
            // Shown ONLY in the Our Product Categories showcase. 2:3 poster.
            poster: { src: IMG.catMen, alt: "NUEVA VIDA MEN — Built for Strength. Made for Men. Supports your everyday health and performance: strong muscles, heart health, immunity support, energy and stamina." },
            name: 'NUEVA VIDA MEN',
            category: 'Daily Multivitamin for Men',
            pill: '#243B7A',
            tint: 'rgba(36, 59, 122, .12)',
            claim: 'Supports Overall Health, Strong Muscles, Heart Health & Immunity',
            copy: 'A complete daily formulation for active men. Grape seed extract standardised to ' +
                  '95% proanthocyanidins sits alongside thirteen vitamins and ten minerals in a single ' +
                  'film-coated tablet — one serving, one tablet, 1.44 g.',
            highlights: [
                'Grape Seed Extract (Proanthocyanidins 95%) — 100 mg per tablet',
                '13 vitamins including A, C, D2, E, K1 and the full B-group',
                '10 minerals including calcium, zinc, iodine, magnesium and selenium',
                'One tablet daily after meals, or as directed by your dietician'
            ],
            specs: [
                { k: 'Pack', v: '60 Tablets' },
                { k: 'Serving', v: '1 tablet (1.44 g)' },
                { k: 'Usage', v: 'Once daily, after meals' },
                { k: 'Category', v: 'Nutraceutical' }
            ],
            facts: [
                { k: 'Grape Seed Extract', v: '100 mg' },
                { k: 'Vitamin C', v: '80 mg · 100% RDA' },
                { k: 'Vitamin D2', v: '600 IU · 100% RDA' },
                { k: 'Vitamin B12', v: '2.2 mcg · 100% RDA' },
                { k: 'Calcium', v: '250 mg · 25% RDA' },
                { k: 'Zinc', v: '11 mg · 65% RDA' },
                { k: 'Selenium', v: '40 mcg · 100% RDA' }
            ],
            note: 'Per 1 serving (1.44 g) = 1 tablet, as printed on pack. ' +
                  'Contains synthetic food colour added & Class II preservatives.',
            images: [
                { src: IMG.menFront, label: 'Front' },
                { src: IMG.menBack, label: 'Nutrition panel' }
            ],
            frames360: []
        },
        {
            id: 'magnesium',
            // Shown ONLY in the Our Product Categories showcase. 2:3 poster.
            poster: { src: IMG.catMagnesium, alt: "NUEVA VIDA Magnesium Glycine Tablets — Complete Nutrition. Stronger Together. For healthy bones, energized life and overall wellness: strong bones, energy and stamina, muscle function, immunity support, joint flexibility, reduced fatigue, heart health." },
            name: 'NUEVA VIDA MAGNESIUM GLYCINE TABLETS',
            shortName: 'MAGNESIUM GLYCINE',
            category: 'Single-Mineral Support',
            pill: '#E3B32A',
            tint: 'rgba(227, 179, 42, .16)',
            claim: 'For Strong Bones, Energy & Muscle Health',
            copy: 'Magnesium in its gentle, glycine-bound form. Each film-coated tablet carries a ' +
                  'Magnesium Glycine Complex equivalent to 250 mg of elemental magnesium — 60% of the ' +
                  'RDA — for anyone who wants a clean, single-mineral top-up rather than a full multivitamin.',
            highlights: [
                'Magnesium Glycine Complex — equivalent to 250 mg elemental magnesium',
                '60% RDA per tablet, calculated on ICMR guidelines',
                '0.60 kcal · 0.000 g fat · 0.000 g cholesterol per tablet',
                '100 tablets per bottle — a longer supply between refills'
            ],
            specs: [
                { k: 'Pack', v: '100 Tablets' },
                { k: 'Elemental Mg', v: '250 mg' },
                { k: '%RDA', v: '60%' },
                { k: 'Category', v: 'Nutraceutical' }
            ],
            facts: [
                { k: 'Elemental Magnesium', v: '250 mg · 60% RDA' },
                { k: 'Energy value', v: '0.60 kcal' },
                { k: 'Carbohydrate', v: '0.15 g' },
                { k: 'Fat', v: '0.000 g' },
                { k: 'Cholesterol', v: '0.000 g' },
                { k: 'Colour', v: 'Titanium Dioxide' }
            ],
            note: '%RDA calculated on ICMR guidelines. Do not exceed the recommended serving size. ' +
                  'Dosage as directed by the dietician.',
            images: [
                { src: IMG.magFront, label: 'Front' },
                { src: IMG.magBack, label: 'Composition' }
            ],
            frames360: []
        },
        {
            id: 'vegomega',
            // Shown ONLY in the Our Product Categories showcase. 2:3 poster.
            poster: { src: IMG.catOmega, alt: "NUEVA VIDA VEG OMEGA — Nourish Naturally. Live Strong. Live Well. Plant-powered omega goodness for everyday health: heart health, brain function, joint support, energy and stamina." },
            name: 'NUEVA VIDA VEG OMEGA',
            shortName: 'VEG OMEGA',
            category: 'Plant-Sourced Omega Blend',
            pill: '#12784A',
            tint: 'rgba(18, 120, 74, .13)',
            claim: 'Omega 3, 6, 7 & 9 — from Flax Seed, Black Seed & Sea Buckthorn',
            copy: 'A fully plant-sourced omega blend. Flax seed, black seed and sea buckthorn together ' +
                  'in a vegetarian capsule — omega 3, 6, 7 and 9 with no fish oil, for people who want ' +
                  'their essential fats without compromising a vegetarian diet.',
            highlights: [
                'Flax Seed 250 mg · Black Seed 150 mg · Sea Buckthorn 100 mg per serving',
                'Omega 3, 6, 7 & 9 from plant sources — no fish oil',
                '60 vegetarian capsules per bottle',
                '1 veg capsule twice a day after meals, or as suggested by your dietician'
            ],
            specs: [
                { k: 'Pack', v: '60 Veg Capsules' },
                { k: 'Serving', v: '1 capsule, twice daily' },
                { k: 'Source', v: 'Plant-based' },
                { k: 'Category', v: 'Health Supplement' }
            ],
            facts: [
                { k: 'Flax Seed', v: '250 mg' },
                { k: 'Black Seed', v: '150 mg' },
                { k: 'Sea Buckthorn', v: '100 mg' },
                { k: 'Energy', v: '1.496' },
                { k: 'Carbohydrate', v: '362 mg' },
                { k: 'Total Fats', v: '0.0' },
                { k: 'Protein', v: '12.1 mg' }
            ],
            note: 'Per serving of 1 veg capsule. Not for medicinal use — health supplement. ' +
                  'Do not exceed the recommended daily dose.',
            images: [
                { src: IMG.omegaFront, label: 'Front' },
                { src: IMG.omegaBack, label: 'Nutrition panel' }
            ],
            /* Turntable frames, in rotational order. `h`, `cx` and `cy` are the
               measured bounding box of the bottle inside each photograph (its
               height as a % of the image, and its centre as a % of width/height).
               The photos were shot at different crops — the front frame renders
               the jar ~14% smaller than the side frames — so the viewer uses
               these numbers to place every frame on the same size and centre.
               Uniform scale only: the product is never stretched. */
            frames360: [
                { src: IMG.omegaSpin0,   label: 'Front',            h: 89.65, cx: 49.10, cy: 49.37 },
                { src: IMG.omegaSpin90,  label: 'Batch & Barcode',  h: 91.28, cx: 50.00, cy: 49.45 },
                { src: IMG.omegaSpin180, label: 'Nutrition Panel',  h: 90.11, cx: 49.56, cy: 49.45 },
                { src: IMG.omegaSpin270, label: 'Usage & Storage',  h: 90.18, cx: 49.51, cy: 49.67 }
            ],
            /* Top-down and base shots — a different axis, so they are separate
               views rather than extra rotation frames. */
            views: [
                { id: 'top',  label: 'Top',  src: IMG.omegaTop,  alt: 'NUEVA VIDA Veg Omega — top of the cap' },
                { id: 'base', label: 'Base', src: IMG.omegaBase, alt: 'NUEVA VIDA Veg Omega — base of the bottle' }
            ]
        }
        ]
    };

    /* ==============================================================
       2 · HELPERS
       ============================================================== */
    var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    var prefersReduced = false;
    try {
        prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* ancient browser — assume motion is fine */ }

    /* Distinct pack shots only. Two identical Cloudinary URLs would otherwise
       give a slider that appears frozen and a 360 view with no back face. */
    function buildGallery(product) {
        var seen = {};
        return (product.images || []).filter(function (im) {
            if (!im || !im.src || seen[im.src]) return false;
            seen[im.src] = 1;
            return true;
        });
    }

    /* Inline icon set — kept here so the page ships zero icon-font requests. */
    var ICON = {
        runner: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.3 3.2a1.9 1.9 0 1 1-.02 3.8 1.9 1.9 0 0 1 .02-3.8Zm-3.1 4.4 3.6-1.1a1.5 1.5 0 0 1 1.6.5l2 2.5a1.4 1.4 0 0 1-.1 1.9l-2.2 2.1 1.5 3.2a1.4 1.4 0 1 1-2.5 1.2l-1.8-3.8a1.5 1.5 0 0 1 .3-1.7l1.2-1.2-1.3-1.6-2.4 4.6a1.5 1.5 0 0 1-.9.7l-4.2 1.2a1.4 1.4 0 0 1-.8-2.7l3.6-1 2.4-4.6a1.5 1.5 0 0 1 .9-.7Z"/><path d="M8.9 16.6a1.4 1.4 0 0 1 .3 2l-2.6 3.2a1.4 1.4 0 1 1-2.2-1.8l2.6-3.2a1.4 1.4 0 0 1 1.9-.2Z"/></svg>',
        chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
        chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
        spin:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.2-6.9"/><path d="M21 3v5h-5"/></svg>',
        drag:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6 4 12l4 6"/><path d="m16 6 4 6-4 6"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
        reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/></svg>',
        zoom:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4M11 8v6M8 11h6"/></svg>'
    };

    /* ==============================================================
       3 · LOADER
       Plays on every arrival at this page and on every refresh — this is
       the brand's front door, so it is deliberately not session-gated.
       Three independent exits (timeline / window load / failsafe) all run
       through the same idempotent finish(), so it can never trap anyone.
       ============================================================== */
    function initLoader() {
        var root    = document.documentElement;
        var overlay = $('#nvLoader');
        if (!overlay) { root.classList.remove('nv-loading'); document.body.classList.add('is-ready'); return; }

        var bar = $('.nv-load__bar', overlay);
        var pct = $('.nv-load__pct', overlay);

        var RAMP_MS   = prefersReduced ? 260 : 1500;  // 0 → 92%
        var HOLD_MS   = prefersReduced ? 60  : 240;   // pause at 100% before lifting
        var FAILSAFE  = 5000;

        var start = (window.performance && performance.now) ? performance.now() : Date.now();
        var now   = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

        var done = false;
        var settled = false;   // ramp finished, waiting on document load
        var shown = 0;

        function paint(v) {
            v = Math.max(0, Math.min(100, v));
            if (v <= shown) return;
            shown = v;
            if (bar) bar.style.width = v + '%';
            if (pct) pct.textContent = (v < 10 ? '0' : '') + Math.round(v) + '%';
        }

        // Ease-out ramp to 92%, then hold until the document is actually ready.
        function tick() {
            if (done) return;
            var t = Math.min(1, (now() - start) / RAMP_MS);
            paint(92 * (1 - Math.pow(1 - t, 3)));
            if (t < 1) { requestAnimationFrame(tick); return; }
            settled = true;
            if (document.readyState === 'complete') complete();
        }

        function complete() {
            if (done) return;
            paint(100);
            setTimeout(finish, HOLD_MS);
        }

        function finish() {
            if (done) return;
            done = true;
            clearTimeout(failsafe);
            overlay.classList.add('is-out');
            root.classList.remove('nv-loading');
            document.body.classList.add('is-ready');
            // Drop it from the DOM once the fade is over so it cannot swallow clicks.
            var kill = function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
            overlay.addEventListener('transitionend', kill, { once: true });
            setTimeout(kill, 900);
        }

        var failsafe = setTimeout(finish, FAILSAFE);

        requestAnimationFrame(tick);

        if (document.readyState === 'complete') {
            // Warm cache: still let the ramp play out rather than snapping away.
            setTimeout(complete, RAMP_MS);
        } else {
            window.addEventListener('load', function () {
                if (settled) complete();
            }, { once: true });
        }
    }

    /* ==============================================================
       4 · RENDER — showcases
       Rows alternate image/copy sides via .nv-show--flip. DOM order stays
       media-then-copy on every row, so the reading order never inverts.
       ============================================================== */
    function slideMarkup(im, i, product) {
        // First frame of the first row is the LCP candidate — eager, the rest lazy.
        var lazy = (i === 0) ? '' : ' loading="lazy"';
        return '' +
            '<div class="nv-slide' + (i === 0 ? ' is-active' : '') + '" data-face="' + esc(im.label || '') + '"' +
                 ' role="group" aria-roledescription="slide"' +
                 ' aria-label="' + esc(product.name + ' — ' + (im.label || 'view ' + (i + 1))) + '">' +
                '<img src="' + esc(im.src) + '"' + lazy + ' decoding="async"' +
                     ' alt="' + esc(product.name + ' pack — ' + (im.label || 'view ' + (i + 1))) + '">' +
            '</div>';
    }

    function sliderMarkup(product, gallery) {
        var slides = gallery.map(function (im, i) { return slideMarkup(im, i, product); }).join('');
        var multi  = gallery.length > 1;

        var dots = multi ? gallery.map(function (im, i) {
            return '<button type="button" class="nv-dot' + (i === 0 ? ' is-active' : '') + '"' +
                   ' data-go="' + i + '" aria-label="Show ' + esc(im.label || ('view ' + (i + 1))) + '"></button>';
        }).join('') : '';

        return '' +
        '<div class="nv-slider" data-slider aria-roledescription="carousel"' +
             ' aria-label="' + esc(product.name) + ' pack images">' +
            '<div class="nv-slider__track" data-track>' + slides + '</div>' +
            '<span class="nv-slider__face" data-face-label>' + esc(gallery[0] && gallery[0].label || '') + '</span>' +
            (multi ?
                '<button type="button" class="nv-slider__nav nv-slider__nav--prev" data-prev aria-label="Previous image">' + ICON.chevL + '</button>' +
                '<button type="button" class="nv-slider__nav nv-slider__nav--next" data-next aria-label="Next image">' + ICON.chevR + '</button>' +
                '<div class="nv-slider__dots" data-dots>' + dots + '</div>' +
                '<span class="nv-slider__timer" data-timer aria-hidden="true"></span>'
                : '') +
        '</div>';
    }

    /* One poster per category. Deliberately a plain figure — no track, no
       dots, no arrows, no timer: the showcase used to carry a front/back
       pack-shot slider, and it is now a single still image per category.
       (sliderMarkup + initSlider remain in this file and are still correct;
       they simply have no callers here any more.) */
    function posterMarkup(product) {
        var p = product.poster;
        if (!p || !p.src) return '';
        return '' +
        '<figure class="nv-show__shot">' +
            '<img src="' + esc(p.src) + '" width="1024" height="1536"' +
                 ' loading="lazy" decoding="async"' +
                 ' alt="' + esc(p.alt || product.name) + '">' +
        '</figure>';
    }

    function showcaseMarkup(product, index) {
        var flip    = (index % 2 === 1);   // 1 & 3 put the copy on the left
        var num     = String(index + 1).padStart(2, '0');

        var bullets = (product.highlights || []).map(function (h) {
            return '<li>' + ICON.check + '<span>' + esc(h) + '</span></li>';
        }).join('');

        var specs = (product.specs || []).map(function (s) {
            return '<div class="nv-spec"><dt>' + esc(s.k) + '</dt><dd>' + esc(s.v) + '</dd></div>';
        }).join('');

        return '' +
        '<article class="nv-show' + (flip ? ' nv-show--flip' : '') + '" id="product-' + esc(product.id) + '"' +
                 ' style="--nv-pill:' + esc(product.pill) + ';--nv-tint:' + esc(product.tint) + '">' +

            '<div class="nv-show__media nv-reveal ' + (flip ? 'nv-reveal--right' : 'nv-reveal--left') + '">' +
                '<span class="nv-show__index" aria-hidden="true">' + num + '</span>' +
                posterMarkup(product) +
            '</div>' +

            '<div class="nv-show__body nv-reveal" style="--nv-d:120ms">' +
                '<p class="nv-show__kicker"><i></i>' + esc(product.category) + '</p>' +
                '<h3 class="nv-show__name">NUEVA <em>VIDA</em> ' +
                    esc((product.shortName || product.name).replace(/^NUEVA VIDA\s*/i, '')) + '</h3>' +
                '<p class="nv-show__claim">' + esc(product.claim) + '</p>' +
                '<div class="nv-show__rule" aria-hidden="true"></div>' +
                '<p class="nv-show__copy">' + esc(product.copy) + '</p>' +
                '<ul class="nv-show__list">' + bullets + '</ul>' +
                '<dl class="nv-specs">' + specs + '</dl>' +
                '<div class="nv-show__cta">' +
                    '<button type="button" class="nv-btn nv-btn--solid" data-open="' + esc(product.id) + '">' +
                        ICON.spin + 'View in 360&deg;</button>' +
                    '<a class="nv-btn nv-btn--ghost" href="#range">Full range' + ICON.chevR + '</a>' +
                '</div>' +
            '</div>' +
        '</article>';
    }

    /* ==============================================================
       5 · RENDER — card grid
       ============================================================== */
    function cardMarkup(product, i) {
        var gallery = buildGallery(product);
        var first   = gallery[0] || { src: '' };
        var pack    = (product.specs || []).filter(function (s) { return s.k === 'Pack'; })[0];

        return '' +
        '<button type="button" class="nv-card nv-reveal nv-reveal--scale" data-open="' + esc(product.id) + '"' +
                ' style="--nv-pill:' + esc(product.pill) + ';--nv-tint:' + esc(product.tint) + ';--nv-d:' + (i * 90) + 'ms">' +
            '<span class="nv-card__media">' +
                '<img src="' + esc(first.src) + '" loading="lazy" decoding="async"' +
                     ' alt="' + esc(product.name) + ' pack">' +
                '<span class="nv-card__spin">' + ICON.spin + '360&deg; View</span>' +
            '</span>' +
            '<span class="nv-card__body">' +
                '<span class="nv-card__cat">' + esc(product.category) + '</span>' +
                '<span class="nv-card__name">' + esc(product.name) + '</span>' +
                '<span class="nv-card__meta">' +
                    '<span>' + esc(pack ? pack.v : '') + '</span>' +
                    '<span>Explore' + '</span>' +
                '</span>' +
            '</span>' +
        '</button>';
    }

    function renderAll() {
        var showcases = $('#nvShowcases');
        var cards     = $('#nvCards');
        if (showcases) showcases.innerHTML = NV_DATA.products.map(showcaseMarkup).join('');
        if (cards)     cards.innerHTML     = NV_DATA.products.map(cardMarkup).join('');
    }

    /* ==============================================================
       6 · SLIDER
       Auto-advances every 4s. Pauses on hover, on keyboard focus, when the
       tab is hidden and when it scrolls out of view — so nothing is
       animating off-screen and nothing moves under the user's cursor.
       ============================================================== */
    var SLIDE_MS = 4000;

    function initSlider(el) {
        var track  = $('[data-track]', el);
        var slides = $$('.nv-slide', el);
        var dots   = $$('.nv-dot', el);
        var timer  = $('[data-timer]', el);
        var faceEl = $('[data-face-label]', el);
        if (!track || slides.length === 0) return;

        var index = 0;
        var paused = false;
        var visible = false;
        var last = 0;
        var elapsed = 0;
        var raf = null;
        var single = slides.length < 2;

        function show(i, viaUser) {
            index = (i + slides.length) % slides.length;
            slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
            dots.forEach(function (d, n) {
                d.classList.toggle('is-active', n === index);
                d.setAttribute('aria-current', n === index ? 'true' : 'false');
            });
            if (faceEl) faceEl.textContent = slides[index].getAttribute('data-face') || '';
            elapsed = 0;
            if (viaUser) { last = 0; }
        }

        function step(ts) {
            raf = requestAnimationFrame(step);
            if (!last) last = ts;
            var dt = ts - last;
            last = ts;
            if (paused || !visible || single) return;
            elapsed += dt;
            if (timer) timer.style.width = Math.min(100, (elapsed / SLIDE_MS) * 100) + '%';
            if (elapsed >= SLIDE_MS) show(index + 1);
        }

        function setPaused(v) {
            paused = v;
            el.classList.toggle('is-paused', v);
        }

        // Pause while the pointer is over the slider, resume on leave.
        el.addEventListener('mouseenter', function () { setPaused(true); });
        el.addEventListener('mouseleave', function () { setPaused(false); });
        el.addEventListener('focusin',    function () { setPaused(true); });
        el.addEventListener('focusout',   function () { setPaused(false); });

        var prev = $('[data-prev]', el);
        var next = $('[data-next]', el);
        if (prev) prev.addEventListener('click', function () { show(index - 1, true); });
        if (next) next.addEventListener('click', function () { show(index + 1, true); });

        var dotWrap = $('[data-dots]', el);
        if (dotWrap) {
            dotWrap.addEventListener('click', function (ev) {
                var b = ev.target.closest('[data-go]');
                if (b) show(parseInt(b.getAttribute('data-go'), 10), true);
            });
        }

        // Arrow keys when the slider (or anything in it) holds focus.
        el.addEventListener('keydown', function (ev) {
            if (ev.key === 'ArrowLeft')  { show(index - 1, true); ev.preventDefault(); }
            if (ev.key === 'ArrowRight') { show(index + 1, true); ev.preventDefault(); }
        });

        // Touch / pen swipe. Vertical scrolling is left alone (touch-action: pan-y).
        var sx = 0, sy = 0, swiping = false;
        track.addEventListener('pointerdown', function (ev) {
            if (single || ev.pointerType === 'mouse') return;
            sx = ev.clientX; sy = ev.clientY; swiping = true;
            setPaused(true);
        }, { passive: true });

        track.addEventListener('pointerup', function (ev) {
            if (!swiping) return;
            swiping = false;
            var dx = ev.clientX - sx;
            var dy = ev.clientY - sy;
            if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1), true);
            setPaused(false);
        }, { passive: true });

        track.addEventListener('pointercancel', function () { swiping = false; setPaused(false); }, { passive: true });

        // Only run the clock while the slider is actually on screen.
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    visible = e.isIntersecting;
                    if (visible && !raf) { last = 0; raf = requestAnimationFrame(step); }
                    if (!visible && raf) { cancelAnimationFrame(raf); raf = null; }
                });
            }, { threshold: 0.25 }).observe(el);
        } else {
            visible = true;
            raf = requestAnimationFrame(step);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { setPaused(true); } else { last = 0; setPaused(false); }
        });

        show(0);
    }

    /* ==============================================================
       7 · 360 VIEWER
       Two honest modes, both driven only by the real supplied images:

         frames — used when a product has 4+ genuine turntable frames.
                  Drag maps horizontal distance onto the frame index.
         faces  — the default here. The real front and back pack shots are
                  mounted as the two faces of one object rotating on its Y
                  axis, so dragging turns the actual bottle around rather
                  than cross-fading two flat pictures.

       Nothing is redrawn, recoloured or synthesised.
       ============================================================== */
    var viewer = (function () {
        var modal, panel, stage, zoomWrap, closeBtn;
        var hud, hudLabelTxt, viewsEl, stepPrev, stepNext;
        var rail, railFill, railThumb, railTicks;
        var infoCat, infoName, infoClaim, infoCopy, infoFacts, infoNote;
        var zoomIn, zoomOut, zoomReset;

        var current = null;
        var mode = 'faces';        // 'faces' | 'spin' | 'image'
        var frames = [];           // frame descriptors, in rotational order
        var frameEls = [];         // main <img> per frame
        var reflectEls = [];       // mirrored <img> per frame
        var facesObj = null;       // the rotating pair, faces mode only
        var shadowEl = null;

        var angle = 0;             // degrees around Y — the single source of truth
        var velocity = 0;
        var zoom = 1;
        var dragging = false, lastX = 0, lastT = 0;
        var raf = null, tween = null, railDrag = false, userTook = false;
        var lastSpinT = 0;         // timestamp of the previous momentum frame
        var pointers = {}, pinchStart = 0, zoomStart = 1, lastFocus = null;

        var MIN_ZOOM = 1, MAX_ZOOM = 2.6;
        var DRAG_DEG = 0.55;       // degrees of rotation per pixel dragged
        var SHIFT = 7;             // px of parallax carried across each dissolve

        var now = function () {
            return (window.performance && performance.now) ? performance.now() : Date.now();
        };

        /* ==========================================================
           BUILD
           ========================================================== */
        function build() {
            modal = document.createElement('div');
            modal.className = 'nv-modal';
            modal.id = 'nvModal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'nvModalName');
            modal.innerHTML = '' +
                '<div class="nv-modal__scrim" data-dismiss></div>' +
                '<div class="nv-modal__panel">' +
                    '<button type="button" class="nv-modal__close" data-dismiss aria-label="Close product viewer">' + ICON.close + '</button>' +
                    '<div class="nv-stage" data-stage>' +
                        '<div class="nv-stage__views" data-views hidden></div>' +
                        '<div class="nv-stage__zoomwrap" data-zoomwrap></div>' +
                        '<div class="nv-hud" data-hud>' +
                            '<p class="nv-hud__label">' + ICON.drag +
                                '<span data-hudlabel>Front</span>' +
                                '<span class="nv-hud__prompt">&middot; Drag to rotate</span>' +
                            '</p>' +
                            '<div class="nv-hud__row">' +
                                '<button type="button" class="nv-tool" data-step="-1" aria-label="Rotate left">' + ICON.chevL + '</button>' +
                                '<div class="nv-rail" data-rail role="slider" tabindex="0"' +
                                     ' aria-label="Product rotation" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0">' +
                                    '<span class="nv-rail__track"></span>' +
                                    '<span class="nv-rail__fill" data-railfill></span>' +
                                    '<span class="nv-rail__ticks" data-railticks></span>' +
                                    '<span class="nv-rail__thumb" data-railthumb></span>' +
                                '</div>' +
                                '<button type="button" class="nv-tool" data-step="1" aria-label="Rotate right">' + ICON.chevR + '</button>' +
                                '<span class="nv-hud__sep" aria-hidden="true"></span>' +
                                '<div class="nv-stage__tools">' +
                                    '<button type="button" class="nv-tool" data-zoom-out aria-label="Zoom out">' + ICON.minus + '</button>' +
                                    '<button type="button" class="nv-tool" data-zoom-in aria-label="Zoom in">' + ICON.plus + '</button>' +
                                    '<button type="button" class="nv-tool" data-zoom-reset aria-label="Reset view">' + ICON.reset + '</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="nv-modal__info">' +
                        '<p class="nv-modal__cat" data-cat></p>' +
                        '<h2 class="nv-modal__name" id="nvModalName" data-name></h2>' +
                        '<p class="nv-modal__claim" data-claim></p>' +
                        '<p class="nv-modal__copy" data-copy></p>' +
                        '<dl class="nv-modal__facts" data-facts></dl>' +
                        '<p class="nv-modal__note" data-note></p>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(modal);

            panel       = $('.nv-modal__panel', modal);
            stage       = $('[data-stage]', modal);
            zoomWrap    = $('[data-zoomwrap]', modal);
            hud         = $('[data-hud]', modal);
            hudLabelTxt = $('[data-hudlabel]', modal);
            viewsEl     = $('[data-views]', modal);
            stepPrev    = $('[data-step="-1"]', modal);
            stepNext    = $('[data-step="1"]', modal);
            rail        = $('[data-rail]', modal);
            railFill    = $('[data-railfill]', modal);
            railThumb   = $('[data-railthumb]', modal);
            railTicks   = $('[data-railticks]', modal);
            closeBtn    = $('.nv-modal__close', modal);
            infoCat     = $('[data-cat]', modal);
            infoName    = $('[data-name]', modal);
            infoClaim   = $('[data-claim]', modal);
            infoCopy    = $('[data-copy]', modal);
            infoFacts   = $('[data-facts]', modal);
            infoNote    = $('[data-note]', modal);
            zoomIn      = $('[data-zoom-in]', modal);
            zoomOut     = $('[data-zoom-out]', modal);
            zoomReset   = $('[data-zoom-reset]', modal);

            wire();
        }

        /* ==========================================================
           RENDERING THE ROTATION
           ========================================================== */

        /* Uniform scale + centre offset that puts this frame's bottle on the
           same size and spot as every other frame's. Derived from the measured
           bounding box, so it corrects the inconsistent crops without touching
           the product itself. */
        function frameBase(f) {
            return { h: (10000 / (f.h || 100)), cx: -(f.cx == null ? 50 : f.cx), cy: -(f.cy == null ? 50 : f.cy) };
        }

        function setFrame(k, o, dx) {
            var el = frameEls[k];
            if (!el) return;
            if (o === 0 && el._o === 0) return;          // already hidden — nothing to write
            var b = el._base;
            var tr = 'translate(calc(' + b.cx + '% + ' + dx.toFixed(2) + 'px), ' + b.cy + '%)';
            el.style.opacity = o;
            el.style.transform = tr;
            el._o = o;
            var re = reflectEls[k];
            if (re) { re.style.opacity = o; re.style.transform = tr; }
        }

        function apply() {
            var a = ((angle % 360) + 360) % 360;

            if (mode === 'spin' && frames.length) {
                var n = frames.length, step = 360 / n;
                var i = Math.floor(a / step) % n;
                var j = (i + 1) % n;
                var t = (a - i * step) / step;
                // Smoothstep: zero slope at both ends, so passing a frame has no
                // visible kick and the dissolve never reads as a cut.
                var s = t * t * (3 - 2 * t);

                for (var k = 0; k < frameEls.length; k++) {
                    if (k === i)      setFrame(k, 1 - s, -SHIFT * s);
                    else if (k === j) setFrame(k, s, SHIFT * (1 - s));
                    else              setFrame(k, 0, 0);
                }
                setLabel(frames[s < 0.5 ? i : j].label);

            } else if (mode === 'faces' && facesObj) {
                facesObj.style.transform = 'rotateY(' + angle + 'deg)';
                setLabel(Math.round(a / 180) % 2 === 1 ? 'Reverse' : 'Front');
            }

            // Shadow narrows as the pack turns edge-on — sells it as a solid object.
            if (shadowEl) {
                var c = Math.abs(Math.cos(angle * Math.PI / 180));
                shadowEl.style.transform = 'translateX(-50%) scaleX(' + (0.42 + 0.58 * c) + ')';
                shadowEl.style.opacity = String(0.35 + 0.65 * c);
            }

            setRail(a / 360, Math.round(a));
        }

        function setLabel(txt) {
            if (hudLabelTxt && hudLabelTxt.textContent !== txt) hudLabelTxt.textContent = txt;
        }

        function setRail(frac, deg) {
            if (!rail) return;
            var w = rail.clientWidth;
            if (!w) return;
            var x = frac * w;
            railThumb.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
            railFill.style.width = x.toFixed(1) + 'px';
            rail.setAttribute('aria-valuenow', String(deg));
        }

        function buildTicks(n) {
            if (!railTicks) return;
            var html = '';
            for (var i = 0; i < n; i++) {
                html += '<span class="nv-rail__tick" style="left:' + (i / n * 100).toFixed(3) + '%"></span>';
            }
            railTicks.innerHTML = html;
        }

        /* ==========================================================
           MOMENTUM
           ========================================================== */
        /* Velocity is measured in degrees per 16ms, so the coast has to be
           scaled by the real frame delta — otherwise a 120Hz display spins
           roughly twice as far from the same flick as a 60Hz one. */
        function spin(ts) {
            raf = null;
            if (dragging) return;

            var t = ts || now();
            var dt = lastSpinT ? Math.min(64, t - lastSpinT) : 16;
            lastSpinT = t;
            var k = dt / 16;

            if (Math.abs(velocity) < 0.04) {
                // Faces mode has only two flat sides, so it settles onto one of
                // them. The turntable can rest at any angle — it is continuous.
                if (mode === 'faces') {
                    var target = Math.round(angle / 180) * 180;
                    var diff = target - angle;
                    if (Math.abs(diff) > 0.35) {
                        angle += diff * (1 - Math.pow(1 - 0.16, k));
                        apply();
                        raf = requestAnimationFrame(spin);
                        return;
                    }
                    angle = target;
                }
                apply();
                return;
            }
            angle += velocity * k;
            velocity *= Math.pow(0.94, k);
            apply();
            raf = requestAnimationFrame(spin);
        }

        function kick() {
            lastSpinT = 0;                 // fresh delta baseline for this coast
            if (!raf) raf = requestAnimationFrame(spin);
        }

        function cancelTween() {
            if (tween) { cancelAnimationFrame(tween); tween = null; }
        }

        function tweenTo(target, ms) {
            cancelTween();
            velocity = 0;
            var from = angle, delta = target - from, t0 = now();
            (function run() {
                var p = Math.min(1, (now() - t0) / ms);
                var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
                angle = from + delta * e;
                apply();
                tween = (p < 1) ? requestAnimationFrame(run) : null;
            })();
        }

        function stepBy(dir) {
            takeOver();
            var n = (mode === 'spin' && frames.length) ? frames.length : 2;
            var step = 360 / n;
            // Snap to the neighbouring detent rather than adding a raw offset, so
            // repeated presses stay on the frame grid instead of drifting.
            tweenTo((Math.round(angle / step) + dir) * step, 460);
        }

        /* Any deliberate input ends the intro nudge and retires the prompt. */
        function takeOver() {
            userTook = true;
            cancelTween();
            if (stage) stage.classList.add('is-touched');
        }

        function setZoom(v, instant) {
            zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v));
            if (zoomOut) zoomOut.disabled = zoom <= MIN_ZOOM + 0.001;
            if (zoomIn) zoomIn.disabled = zoom >= MAX_ZOOM - 0.001;
            if (zoomWrap) {
                zoomWrap.style.transition = instant ? 'none' : '';
                zoomWrap.style.transform = 'scale(' + zoom + ')';
            }
        }

        /* ==========================================================
           INPUT
           ========================================================== */
        function pinchDistance() {
            var p = Object.keys(pointers).map(function (k) { return pointers[k]; });
            if (p.length < 2) return 0;
            return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        }

        function wire() {
            modal.addEventListener('click', function (ev) {
                if (ev.target.closest('[data-dismiss]')) close();
            });

            /* ---- drag on the stage ---- */
            stage.addEventListener('pointerdown', function (ev) {
                if (ev.target.closest('.nv-hud, .nv-stage__views')) return;   // controls handle themselves
                pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };

                if (Object.keys(pointers).length === 2) {
                    pinchStart = pinchDistance();
                    zoomStart = zoom;
                    dragging = false;
                    stage.classList.remove('is-dragging');
                    return;
                }
                takeOver();
                dragging = true;
                velocity = 0;
                lastX = ev.clientX;
                lastT = ev.timeStamp || Date.now();
                stage.classList.add('is-dragging');
                try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* not capturable */ }
            });

            stage.addEventListener('pointermove', function (ev) {
                if (!pointers[ev.pointerId]) return;
                pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };

                if (Object.keys(pointers).length === 2) {
                    var d = pinchDistance();
                    if (pinchStart > 0) setZoom(zoomStart * (d / pinchStart), true);
                    return;
                }
                if (!dragging) return;

                var t = ev.timeStamp || Date.now();
                var dx = ev.clientX - lastX;
                var dt = Math.max(1, t - lastT);

                angle += dx * DRAG_DEG;
                velocity = (dx * DRAG_DEG) / dt * 16;
                lastX = ev.clientX;
                lastT = t;
                apply();
                ev.preventDefault();
            });

            function release(ev) {
                delete pointers[ev.pointerId];
                if (Object.keys(pointers).length < 2) { pinchStart = 0; setZoom(zoom); }
                if (!Object.keys(pointers).length) stage.classList.remove('is-dragging');
                if (!dragging) return;
                dragging = false;
                stage.classList.remove('is-dragging');
                velocity = Math.max(-22, Math.min(22, velocity));
                kick();
            }
            stage.addEventListener('pointerup', release);
            stage.addEventListener('pointercancel', release);
            stage.addEventListener('pointerleave', function (ev) {
                if (pointers[ev.pointerId]) release(ev);
            });

            // Wheel zooms rather than scrolling the page behind the modal.
            stage.addEventListener('wheel', function (ev) {
                ev.preventDefault();
                takeOver();
                setZoom(zoom + (ev.deltaY < 0 ? 0.14 : -0.14), true);
            }, { passive: false });

            /* ---- rotation rail: scrub straight to an angle ---- */
            function railTo(clientX) {
                var r = rail.getBoundingClientRect();
                if (!r.width) return;
                var frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
                angle = frac * 360;
                apply();
            }
            rail.addEventListener('pointerdown', function (ev) {
                takeOver();
                railDrag = true;
                velocity = 0;
                railTo(ev.clientX);
                try { rail.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
                ev.preventDefault();
            });
            rail.addEventListener('pointermove', function (ev) {
                if (railDrag) { railTo(ev.clientX); ev.preventDefault(); }
            });
            ['pointerup', 'pointercancel'].forEach(function (t) {
                rail.addEventListener(t, function () { railDrag = false; });
            });
            rail.addEventListener('keydown', function (ev) {
                if (ev.key === 'ArrowLeft')  { stepBy(-1); ev.preventDefault(); }
                if (ev.key === 'ArrowRight') { stepBy(1); ev.preventDefault(); }
            });

            /* ---- step buttons ---- */
            [stepPrev, stepNext].forEach(function (b) {
                if (!b) return;
                b.addEventListener('click', function () {
                    stepBy(parseInt(b.getAttribute('data-step'), 10));
                });
            });

            /* ---- view chips (360 spin / top / base) ---- */
            viewsEl.addEventListener('click', function (ev) {
                var chip = ev.target.closest('[data-view]');
                if (chip) setView(chip.getAttribute('data-view'));
            });

            /* ---- zoom ---- */
            if (zoomIn)  zoomIn.addEventListener('click', function () { takeOver(); setZoom(zoom + 0.25); });
            if (zoomOut) zoomOut.addEventListener('click', function () { takeOver(); setZoom(zoom - 0.25); });
            if (zoomReset) zoomReset.addEventListener('click', function () {
                takeOver();
                setZoom(1);
                velocity = 0;
                tweenTo(Math.round(angle / 360) * 360, 420);
            });

            document.addEventListener('keydown', function (ev) {
                if (!modal.classList.contains('is-open')) return;
                if (ev.key === 'Escape') { close(); return; }
                if (ev.key === 'ArrowLeft')  { stepBy(-1); ev.preventDefault(); }
                if (ev.key === 'ArrowRight') { stepBy(1); ev.preventDefault(); }
                if (ev.key === 'Tab') trapFocus(ev);
            });
        }

        // Keep tabbing inside the dialog while it is open.
        function trapFocus(ev) {
            var f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', panel)
                .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
            else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
        }

        /* ==========================================================
           MOUNTING
           ========================================================== */

        /* Every ring frame must be decoded before dragging starts, otherwise
           the first pass around the bottle flickers through blank frames. */
        function preload(list, done) {
            var left = list.length;
            if (!left) { done(); return; }
            list.forEach(function (f) {
                var im = new Image();
                im.decoding = 'async';
                im.onload = im.onerror = function () { if (--left === 0) done(); };
                im.src = f.src;
            });
        }

        function mountSpin(product) {
            frames = product.frames360.slice();
            mode = 'spin';

            var stackHtml = '', reflectHtml = '';
            frames.forEach(function (f, i) {
                var b = frameBase(f);
                var style = 'height:' + b.h.toFixed(3) + '%;';
                var alt = esc(product.name + ' — ' + (f.label || ('view ' + (i + 1))));
                stackHtml   += '<img class="nv-spin__f" style="' + style + '" src="' + esc(f.src) + '" alt="' + alt + '" draggable="false">';
                reflectHtml += '<img class="nv-spin__f" style="' + style + '" src="' + esc(f.src) + '" alt="" aria-hidden="true" draggable="false">';
            });

            zoomWrap.innerHTML =
                '<div class="nv-spin" data-spin>' +
                    '<div class="nv-spin__stack" data-stack>' + stackHtml + '</div>' +
                    '<div class="nv-spin__reflect" data-reflect aria-hidden="true">' + reflectHtml + '</div>' +
                    '<span class="nv-spin__contact" aria-hidden="true"></span>' +
                    '<div class="nv-spin__loading" data-spinload>' +
                        '<span class="nv-spin__ring" aria-hidden="true"></span>' +
                        '<p>Preparing 360&deg; view</p>' +
                    '</div>' +
                '</div>';

            frameEls   = $$('[data-stack] .nv-spin__f', zoomWrap);
            reflectEls = $$('[data-reflect] .nv-spin__f', zoomWrap);
            facesObj = null;
            shadowEl = null;

            frameEls.forEach(function (el, i) { el._base = frameBase(frames[i]); el._o = -1; });
            reflectEls.forEach(function (el, i) { el._base = frameBase(frames[i]); el._o = -1; });

            buildTicks(frames.length);
            hud.classList.remove('is-still');

            var gate = $('[data-spinload]', zoomWrap);
            preload(frames, function () {
                if (gate) gate.hidden = true;
                // Intro nudge: swing in from a quarter turn and settle on the
                // front. Says "this rotates" without a caption, and any real
                // input cancels it.
                if (!userTook && !prefersReduced) {
                    angle = 44;
                    apply();
                    setTimeout(function () { if (!userTook) tweenTo(0, 1250); }, 260);
                } else {
                    angle = 0;
                    apply();
                }
            });

            angle = 0;
            apply();
        }

        function mountFaces(product) {
            mode = 'faces';
            var gallery = buildGallery(product);
            var front = gallery[0];
            var back  = gallery[1] || gallery[0];

            zoomWrap.innerHTML =
                '<div class="nv-stage__persp">' +
                    '<div class="nv-stage__obj" data-obj style="transform-style:preserve-3d">' +
                        '<div class="nv-stage__face nv-stage__face--front">' +
                            '<img src="' + esc(front.src) + '" decoding="async" alt="' + esc(product.name) + ' — front of pack" draggable="false">' +
                        '</div>' +
                        '<div class="nv-stage__face nv-stage__face--back">' +
                            '<img src="' + esc(back.src) + '" decoding="async" alt="' + esc(product.name) + ' — ' +
                                esc((gallery[1] && gallery[1].label) || 'reverse of pack') + '" draggable="false">' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<span class="nv-stage__shadow" data-shadow aria-hidden="true"></span>';

            facesObj = $('[data-obj]', zoomWrap);
            shadowEl = $('[data-shadow]', zoomWrap);
            frames = []; frameEls = []; reflectEls = [];
            buildTicks(2);
            hud.classList.remove('is-still');
            angle = 0;
            apply();
        }

        function mountStill(view) {
            mode = 'still';
            zoomWrap.innerHTML =
                '<div class="nv-still">' +
                    '<img class="nv-still__img" src="' + esc(view.src) + '" alt="' + esc(view.alt || '') + '" draggable="false">' +
                '</div>';
            frames = []; frameEls = []; reflectEls = [];
            facesObj = null; shadowEl = null;
            hud.classList.add('is-still');
            setLabel(view.label);
        }

        function setView(id) {
            if (!current) return;
            takeOver();
            setZoom(1, true);
            $$('[data-view]', viewsEl).forEach(function (c) {
                c.classList.toggle('is-active', c.getAttribute('data-view') === id);
            });
            if (id === 'spin') {
                if (current.frames360 && current.frames360.length >= 3) mountSpin(current);
                else mountFaces(current);
                return;
            }
            var v = (current.views || []).filter(function (x) { return x.id === id; })[0];
            if (v) mountStill(v);
        }

        function mountViewChips(product) {
            var views = product.views || [];
            if (!views.length) { viewsEl.hidden = true; viewsEl.innerHTML = ''; return; }
            viewsEl.hidden = false;
            viewsEl.innerHTML =
                '<button type="button" class="nv-view-chip is-active" data-view="spin">360&deg;</button>' +
                views.map(function (v) {
                    return '<button type="button" class="nv-view-chip" data-view="' + esc(v.id) + '">' + esc(v.label) + '</button>';
                }).join('');
        }

        function mountProduct(product) {
            mountViewChips(product);

            if (product.frames360 && product.frames360.length >= 3) mountSpin(product);
            else mountFaces(product);

            infoCat.textContent   = product.category;
            infoName.textContent  = product.name;
            infoClaim.textContent = product.claim;
            infoCopy.textContent  = product.copy;
            infoFacts.innerHTML   = (product.facts || []).map(function (f) {
                return '<div class="nv-fact"><dt>' + esc(f.k) + '</dt><dd>' + esc(f.v) + '</dd></div>';
            }).join('');
            infoNote.textContent = product.note || '';

            stage.style.setProperty('--nv-tint', product.tint || '');
            stage.classList.remove('is-touched');
            hud.hidden = false;
        }

        /* ==========================================================
           OPEN / CLOSE
           ========================================================== */
        function open(id) {
            if (!modal) build();
            var product = NV_DATA.products.filter(function (p) { return p.id === id; })[0];
            if (!product) return;

            current = product;
            userTook = false;
            cancelTween();
            modal.classList.remove('nv-modal--image');
            angle = 0; velocity = 0;
            setZoom(1, true);
            mountProduct(product);
            reveal();
        }

        /* Plain zoomable lightbox — used by the hero artwork. */
        function openImage(src, alt) {
            if (!modal) build();
            current = null;
            mode = 'image';
            userTook = true;
            cancelTween();
            modal.classList.add('nv-modal--image');
            viewsEl.hidden = true;
            hud.hidden = true;
            frames = []; frameEls = []; reflectEls = [];
            facesObj = null; shadowEl = null;
            zoomWrap.innerHTML = '<img class="nv-lightbox" src="' + esc(src) + '" alt="' + esc(alt || '') + '" draggable="false">';
            angle = 0; velocity = 0;
            setZoom(1, true);
            reveal();
        }

        function reveal() {
            lastFocus = document.activeElement;
            modal.classList.add('is-open');
            document.documentElement.style.overflow = 'hidden';
            // Focus the close button so Escape and Tab have somewhere to start.
            // Done directly rather than inside rAF — a backgrounded tab gets no
            // animation frames, and the dialog would open untrapped.
            if (closeBtn) {
                try { closeBtn.focus(); } catch (e) { /* not focusable yet */ }
                if (document.activeElement !== closeBtn) setTimeout(function () { closeBtn.focus(); }, 40);
            }
            // The rail can only be positioned once it has a measured width.
            setTimeout(function () { apply(); }, 60);
        }

        function close() {
            if (!modal) return;
            modal.classList.remove('is-open');
            document.documentElement.style.overflow = '';
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            cancelTween();
            pointers = {};
            dragging = false;
            railDrag = false;
            // Free the image memory once the fade is done.
            setTimeout(function () {
                if (!modal.classList.contains('is-open')) zoomWrap.innerHTML = '';
            }, 500);
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        }

        return { open: open, openImage: openImage, close: close };
    })();

    /* ==============================================================
       8 · SCROLL REVEAL
       ============================================================== */
    function initReveal() {
        var items = $$('.nv-reveal');
        if (!('IntersectionObserver' in window) || prefersReduced) {
            document.body.classList.add('nv-noreveal');
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                io.unobserve(e.target);          // reveal once, then stop watching
            });
        }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
        items.forEach(function (el) { io.observe(el); });
    }

    /* ==============================================================
       9 · STICKY BAR
       ============================================================== */
    function initBar() {
        var bar = $('#nvBar');
        var mast = $('.nv-masthead');
        if (!bar || !mast) return;

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                bar.classList.toggle('is-pinned', !entries[0].isIntersecting);
            }, { threshold: 0 }).observe(mast);
        } else {
            window.addEventListener('scroll', function () {
                bar.classList.toggle('is-pinned', window.scrollY > mast.offsetHeight);
            }, { passive: true });
        }
    }

    /* ==============================================================
       10 · WIRING
       ============================================================== */
    /* ==============================================================
       10a · HERO SLIDER
       Four banners, one at a time, built entirely from NV_HERO_SLIDES.

       Motion is deliberately slow and quiet: a 1.15s cross-dissolve with
       a barely-there scale settle, and copy that fades up a beat behind
       the artwork. Nothing bounces, nothing zooms hard.
       ============================================================== */
    function initHeroSlider() {
        var stage = $('#nvsStage');
        if (!stage) return;

        var root = $('#nvHero');
        var data = (NV_HERO_SLIDES || []).filter(function (s) { return s && s.image; });
        if (!data.length) return;

        var HOLD = 6500;          // long hold — a luxury hero should not hurry
        var index = 0;
        var timer = null;
        var paused = false;
        var onScreen = true;

        /* ---- build ---- */
        var figs = [];
        var frag = document.createDocumentFragment();

        data.forEach(function (s, i) {
            var fig = document.createElement('figure');
            fig.className = 'nvs__slide' + (i === 0 ? ' is-active' : '');
            // Only an off-ratio banner carries one; see NV_HERO_SLIDES.
            if (s.field) fig.style.background = s.field;
            fig.setAttribute('role', 'group');
            fig.setAttribute('aria-roledescription', 'slide');
            fig.setAttribute('aria-label', (i + 1) + ' of ' + data.length + (s.title ? ': ' + s.title : ''));
            if (i) fig.setAttribute('aria-hidden', 'true');

            var img = document.createElement('img');
            img.className = 'nvs__img';
            img.alt = s.alt || s.title || '';
            img.decoding = 'async';
            img.draggable = false;
            /* Intrinsic size reserves the box before the bytes arrive, so a
               slide can never resize the stage as it loads. */
            img.width = 1536;
            img.height = 1024;

            /* Slide one is the LCP candidate and loads immediately. The others
               are held back — but NOT with loading="lazy". Every slide after
               the first is hidden by opacity/visibility, and a lazy image that
               is never "near the viewport" in the browser's reckoning may not
               fetch at all, then pops in mid-dissolve. So they are fetched
               explicitly once the page is done loading, and any slide that is
               about to be shown is promoted ahead of its turn. */
            if (i === 0) {
                img.src = s.image;
                img.setAttribute('fetchpriority', 'high');
            } else {
                img.setAttribute('data-src', s.image);
                img.setAttribute('fetchpriority', 'low');
            }
            fig.appendChild(img);

            var copy = buildCopy(s);
            if (copy) fig.appendChild(copy);

            frag.appendChild(fig);
            figs.push(fig);
        });

        stage.appendChild(frag);

        function buildCopy(s) {
            if (!s.eyebrow && !s.description && !s.cta) return null;   // artwork-only slide
            var box = document.createElement('div');
            box.className = 'nvs__copy nvs__copy--' + (s.align === 'center' ? 'center' : 'left') +
                            ' nvs__copy--' + (s.tone === 'light' ? 'light' : 'dark');
            var inner = document.createElement('div');
            inner.className = 'nvs__copyIn';

            if (s.eyebrow) {
                var e = document.createElement('p');
                e.className = 'nvs__eyebrow';
                e.textContent = s.eyebrow;
                inner.appendChild(e);
            }
            if (s.title) {
                var h = document.createElement('h2');
                h.className = 'nvs__title';
                h.textContent = s.title;
                inner.appendChild(h);
            }
            if (s.description) {
                var d = document.createElement('p');
                d.className = 'nvs__desc';
                d.textContent = s.description;
                inner.appendChild(d);
            }
            if (s.cta) {
                var a = document.createElement('a');
                a.className = 'nvs__cta';
                a.href = s.href || '#range';
                a.textContent = s.cta;
                var arrow = document.createElement('span');
                arrow.className = 'nvs__ctaArrow';
                arrow.setAttribute('aria-hidden', 'true');
                arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
                    'stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
                a.appendChild(arrow);
                inner.appendChild(a);
            }
            box.appendChild(inner);
            return box;
        }

        /* ---- pagination: one hairline tick per slide ---- */
        var ticksWrap = $('#nvsTicks');
        var ticks = [];
        if (ticksWrap) {
            data.forEach(function (s, i) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'nvs__tick' + (i === 0 ? ' is-active' : '');
                b.setAttribute('aria-label', 'Go to slide ' + (i + 1) + (s.title ? ': ' + s.title : ''));
                b.innerHTML = '<span class="nvs__tickFill"></span>';
                b.addEventListener('click', function () { show(i); });
                ticksWrap.appendChild(b);
                ticks.push(b);
            });
        }

        var counter = $('#nvsCount');

        function promote(i) {
            var img = $('.nvs__img', figs[i]);
            if (img && !img.getAttribute('src') && img.getAttribute('data-src')) {
                img.src = img.getAttribute('data-src');
                img.removeAttribute('data-src');
            }
        }

        function show(i) {
            index = (i + figs.length) % figs.length;
            promote(index);
            promote((index + 1) % figs.length);          // stay one ahead

            figs.forEach(function (f, n) {
                var on = n === index;
                f.classList.toggle('is-active', on);
                f.setAttribute('aria-hidden', on ? 'false' : 'true');
                // No keyboard focus may land on a CTA inside a hidden slide.
                $$('a, button', f).forEach(function (el) {
                    if (on) el.removeAttribute('tabindex');
                    else el.setAttribute('tabindex', '-1');
                });
            });

            ticks.forEach(function (t, n) {
                t.classList.toggle('is-active', n === index);
                t.setAttribute('aria-current', n === index ? 'true' : 'false');
                var fill = $('.nvs__tickFill', t);
                if (fill) {                                // restart the fill
                    fill.style.animation = 'none';
                    void fill.offsetWidth;
                    fill.style.animation = '';
                }
            });

            if (counter) counter.textContent = pad(index + 1) + ' / ' + pad(figs.length);
            restart();
        }

        function pad(n) { return (n < 10 ? '0' : '') + n; }
        function next() { show(index + 1); }
        function prev() { show(index - 1); }

        /* The advance is a timer, never requestAnimationFrame — the tick fill
           is the only thing rAF-adjacent here and it is purely cosmetic, so a
           renderer that withholds frames still changes slides. */
        function restart() {
            clearTimeout(timer);
            timer = null;
            if (paused || !onScreen || prefersReduced || figs.length < 2) return;
            timer = setTimeout(next, HOLD);
        }

        function setPaused(v) {
            if (paused === v) return;
            paused = v;
            // On the section, not the stage: the tick rail is a sibling of the
            // frame, so a class on the stage cannot reach it with a combinator.
            if (root) root.classList.toggle('is-paused', v);
            restart();
        }

        /* ---- controls ---- */
        var prevBtn = $('#nvsPrev'), nextBtn = $('#nvsNext');
        if (prevBtn) prevBtn.addEventListener('click', prev);
        if (nextBtn) nextBtn.addEventListener('click', next);

        if (root) {
            root.addEventListener('mouseenter', function () { setPaused(true); });
            root.addEventListener('mouseleave', function () { setPaused(false); });
            root.addEventListener('focusin', function () { setPaused(true); });
            root.addEventListener('focusout', function () { setPaused(false); });
            root.addEventListener('keydown', function (ev) {
                if (ev.key === 'ArrowLeft') { prev(); ev.preventDefault(); }
                if (ev.key === 'ArrowRight') { next(); ev.preventDefault(); }
            });
        }

        /* Click the artwork to open it full size — the behaviour the single
           hero image had, now per slide. A swipe must not count as a click. */
        var sx = 0, sy = 0, swiping = false, moved = false;
        stage.addEventListener('pointerdown', function (ev) {
            sx = ev.clientX; sy = ev.clientY; swiping = true; moved = false;
            if (ev.pointerType !== 'mouse') setPaused(true);
        }, { passive: true });

        stage.addEventListener('pointermove', function (ev) {
            if (swiping && Math.abs(ev.clientX - sx) > 8) moved = true;
        }, { passive: true });

        stage.addEventListener('pointerup', function (ev) {
            if (!swiping) return;
            swiping = false;
            var dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) next(); else prev();
            } else if (!moved && !ev.target.closest('a, button')) {
                var s = data[index];
                viewer.openImage(s.image, s.alt || s.title || '');
            }
            if (ev.pointerType !== 'mouse') setPaused(false);
        }, { passive: true });

        stage.addEventListener('pointercancel', function () {
            swiping = false; setPaused(false);
        }, { passive: true });

        // Only run the clock while the hero is actually on screen.
        if ('IntersectionObserver' in window && root) {
            new IntersectionObserver(function (entries) {
                var was = onScreen;
                onScreen = entries[0].isIntersecting;
                if (was !== onScreen) restart();
            }, { threshold: 0.2 }).observe(root);
        }

        document.addEventListener('visibilitychange', function () {
            setPaused(document.hidden);
        });

        /* Pull the remaining banners down once the page itself is done, so
           they are decoded and ready long before their turn comes up. */
        function warm() { data.forEach(function (s, i) { if (i) promote(i); }); }
        if (document.readyState === 'complete') setTimeout(warm, 400);
        else window.addEventListener('load', function () { setTimeout(warm, 400); });
        setTimeout(warm, 3000);          // net for a load event that never fires

        show(0);
    }

    // One delegated listener covers every [data-open] — cards and CTAs alike.
    function initOpeners() {
        document.addEventListener('click', function (ev) {
            var t = ev.target.closest('[data-open]');
            if (!t) return;
            ev.preventDefault();
            viewer.open(t.getAttribute('data-open'));
        });
    }

    function initAnchors() {
        document.addEventListener('click', function (ev) {
            var a = ev.target.closest('a[href^="#"]');
            if (!a) return;
            var id = a.getAttribute('href');
            if (id.length < 2) return;
            var target = document.getElementById(id.slice(1));
            if (!target) return;
            ev.preventDefault();
            target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
        });
    }

    function boot() {
        document.body.classList.remove('no-js');
        renderAll();
        $$('[data-slider]').forEach(initSlider);
        initReveal();
        initBar();
        initHeroSlider();
        initOpeners();
        initAnchors();
        initLoader();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();

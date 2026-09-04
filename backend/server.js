require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const mongoSanitize  = require('express-mongo-sanitize');
const cookieParser   = require('cookie-parser');
const path           = require('path');

const connectDB      = require('./config/database');
const errorMiddleware = require('./middleware/errorMiddleware');
const { verifyMailTransport } = require('./services/emailService');

const app = express();

// ── PROXY ────────────────────────────────────────────────────────────────────
// The app runs behind a reverse proxy (Cloud Run / load balancer). Without this,
// req.ip is the proxy's address, so express-rate-limit keys every client into a
// single bucket (brute-force protection void, collective throttling) and stored
// IPs are useless. Trust the first proxy hop so req.ip = the real client IP.
app.set('trust proxy', 1);

// ── SECURITY ─────────────────────────────────────────────────────────────────
// Content-Security-Policy tuned for this static, inline-heavy frontend:
// 'unsafe-inline' is required because the pages use inline <script> blocks,
// inline styles and inline onclick handlers throughout. The value of the policy
// here is restricting WHICH external origins may load scripts/styles/frames,
// plus blocking plugins (object-src) and clickjacking (frame-ancestors).
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc:     ["'self'"],
      // checkout.razorpay.com serves the Checkout SDK; without it the payment
      // modal is blocked by CSP and never opens. cdn.razorpay.com serves the
      // risk-detection bundle that Checkout pulls in itself — omitting it left
      // every live payment running with fraud detection blocked.
      // googletagmanager.com serves BOTH the GTM container and gtag.js; without
      // it neither analytics snippet on the pages could ever execute.
      // connect.facebook.net = Facebook Pixel (fbevents.js). googleadservices.com
      // + googleads.g.doubleclick.net = Google Ads conversion tracking. These
      // tags are fired by GTM; the CSP must allow their scripts to load.
      scriptSrc:      ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://checkout.razorpay.com', 'https://cdn.razorpay.com', 'https://www.googletagmanager.com', 'https://connect.facebook.net', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net'],
      scriptSrcAttr:  ["'unsafe-inline'"], // inline onclick handlers used across the pages
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://api.fontshare.com', 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      fontSrc:        ["'self'", 'data:', 'https://cdn.fontshare.com', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      imgSrc:         ["'self'", 'data:', 'https:'],
      // Checkout posts telemetry to lumberjack.* and talks to api.razorpay.com.
      // GA4/GTM beacon to google-analytics.com and googletagmanager.com.
      // Facebook Pixel beacons to connect.facebook.net + www.facebook.com;
      // Google Ads conversion beacons to google.com/ccm, *.doubleclick.net and
      // googleadservices.com. Without these the Pixel/Ads pings are CSP-blocked.
      connectSrc:     ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://lumberjack-metrics.razorpay.com', 'https://www.google-analytics.com', 'https://analytics.google.com', 'https://stats.g.doubleclick.net', 'https://www.googletagmanager.com', 'https://www.google.com', 'https://connect.facebook.net', 'https://www.facebook.com', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net', 'https://ad.doubleclick.net'],
      // Razorpay renders its modal (and bank/UPI redirects) inside iframes.
      // googletagmanager.com covers the GTM <noscript> fallback iframe.
      // www.facebook.com + td.doubleclick.net cover the Pixel / Google Ads
      // conversion-linker iframes.
      frameSrc:       ["'self'", 'https://www.google.com', 'https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://www.googletagmanager.com', 'https://www.facebook.com', 'https://td.doubleclick.net'],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      frameAncestors: ["'self'"],
      // Bank / 3-D Secure pages are reached by form POST during checkout.
      formAction:     ["'self'", 'https://api.razorpay.com'],
    },
  },
}));
app.use(mongoSanitize());

// ── CORS ──────────────────────────────────────────────────────────────────────
/**
 * CORS Configuration with Security
 * - Production: Only allow configured frontend URL
 * - Development: Allow localhost variants for testing
 * - Never allow null/undefined origins
 */
const corsOptions = {
  origin: (origin, cb) => {
    // Build list of allowed origins
    const allowedOrigins = [];

    // Always add frontend URL if configured
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    // Production origins
    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push('https://fairfordpharma.com');
      allowedOrigins.push('https://www.fairfordpharma.com');
    }

    // Development origins
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:5000');
      allowedOrigins.push('http://127.0.0.1:5000');
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://127.0.0.1:3000');
    }

    // Allow requests with no Origin header. A browser sends no Origin on a
    // top-level page navigation (loading index.html / retailer.html / admin.html),
    // and static assets, curl and server-to-server calls also omit it. CORS only
    // protects CROSS-origin browser requests, which always carry an Origin header,
    // so rejecting origin-less requests just breaks loading the site itself.
    if (!origin) {
      return cb(null, true);
    }

    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }

    // Deny request if origin not in whitelist
    console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
    return cb(new Error(`CORS: Origin ${origin} is not allowed`));
  },
  credentials:         true,
  optionsSuccessStatus: 200,
  methods:             ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders:      ['Content-Type', 'Authorization'],
  maxAge:              3600, // 1 hour - cache preflight requests
};
app.use(cors(corsOptions));

// ── BODY PARSING ──────────────────────────────────────────────────────────────
// The Razorpay webhook signature is an HMAC over the EXACT bytes Razorpay sent,
// so that one route needs the raw buffer. It must be registered before
// express.json() — body-parser marks the request as read (req._body), so the
// JSON parser below skips it and req.body stays a Buffer.
app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
}));

/**
 * Strict rate limiter for auth endpoints
 * Limits login/signup attempts to prevent brute force attacks
 * Combined with account lockout mechanism in authController
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  skipSuccessfulRequests: true, // only failed requests count toward the limit
  message: {
    success: false,
    message: 'Too many failed attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/authRoutes');
const productRoutes      = require('./routes/productRoutes');
const categoryRoutes     = require('./routes/categoryRoutes');
const retailerRoutes     = require('./routes/retailerRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const superadminRoutes   = require('./routes/superadminRoutes');
const orderRoutes        = require('./routes/orderRoutes');
const paymentRoutes      = require('./routes/paymentRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const schemeRoutes       = require('./routes/schemeRoutes');
const newsletterRoutes   = require('./routes/newsletterRoutes');
const contactRoutes      = require('./routes/contactRoutes');
const distInventoryRoutes = require('./routes/distributorInventoryRoutes');

// Health check
app.get('/api/health', (_req, res) =>
  res.json({ success: true, status: 'OK', env: process.env.NODE_ENV || 'development' })
);

app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/products',     productRoutes);
app.use('/api/categories',   categoryRoutes);
app.use('/api/retailer',     retailerRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/superadmin',   superadminRoutes);
app.use('/api/orders',       orderRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/schemes',      schemeRoutes); 
app.use('/api/newsletter',   newsletterRoutes);
app.use('/api/contact',      contactRoutes);
app.use('/api/dist-inventory', distInventoryRoutes);

// ── STATIC / FRONTEND ─────────────────────────────────────────────────────────
app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.static(path.join(__dirname, '..', 'image')));

// ── SEO SSR SHARED HELPERS ────────────────────────────────────────────────────
// Product detail + category pages have their <head> server-rendered so crawlers
// that don't run JS still get real per-page SEO. Templates are static between
// deploys — read once and cache; the per-page head is injected fresh per request.
const fs = require('fs');
const Product = require('./models/Product');
const { injectProductSeo } = require('./services/productSeo');
const { injectCategorySeo, resolveCategory, getCategoryCounts, categoryUrl } = require('./services/categorySeo');

const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
let _detailHtml = null, _productHtml = null;
const detailTemplate = () => (_detailHtml || (_detailHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'productdetail.html'), 'utf8')));
const productTemplate = () => (_productHtml || (_productHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'product.html'), 'utf8')));

// /product.html?category=<Name> → a real, self-canonical category landing page
// with a per-category <head>. Must run BEFORE the static middleware, which would
// otherwise serve the raw file. The bare catalogue (and any multi-facet / search
// combination) falls through to the static default so filter permutations are
// never indexed as distinct pages.
app.get('/product.html', async (req, res, next) => {
  try {
    const cat = req.query.category;
    const single = typeof cat === 'string' && cat && cat.indexOf(',') < 0
      && !req.query.search && !req.query.type && !req.query.stock;
    if (!single) return next();               // bare catalogue / faceted view → static
    const match = resolveCategory(cat, await getCategoryCounts());
    if (!match) return next();                // unknown category → static catalogue
    return res.type('html').send(injectCategorySeo(productTemplate(), match.name, match.count));
  } catch (_) {
    return next();                            // never fail the page over SEO injection
  }
});

// Serve the frontend pages at the site root so clean page URLs resolve —
// /product.html, /login&signup.html, /retailer.html, /superadmin.html, etc.
// Previously only '/' was routed, so every other page (and the post-login
// redirect targets) returned the 404 JSON handler.
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'))
);

// ── LEGACY URL REDIRECTS ──────────────────────────────────────────────────────
// The site previously ran on a WooCommerce-style URL scheme (/product/<slug>/,
// /product-category/<slug>/). Those URLs are still indexed and inbound-linked
// but this app never served them, so every one of them hits the 404 handler
// below and the link equity is lost.
//
// 301 (permanent) so search engines transfer ranking to the new URL. Products
// are matched on the `slug` field the Product model already generates from the
// name; anything that no longer exists falls back to the catalogue rather than
// 404-ing, which keeps the visitor on-site.
// fs, Product, injectProductSeo and detailTemplate() are declared above, before
// the static middleware (the /product.html category interceptor needs them too).
app.get(['/product/:slug', '/product/:slug/'], async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    // Full record so the <head> can be server-rendered. The Product model's
    // pre(/^find/) hook auto-populates `category` (categoryName/categorySlug).
    const product = await Product.findOne({ slug }).lean();
    // Live product → serve the detail page AT this clean URL with a 200 (not a
    // redirect), with title/meta/canonical/OG and Product+BreadcrumbList JSON-LD
    // already rendered into the HTML so crawlers that don't run JavaScript get
    // the real per-product SEO. productdetail.js re-applies identical values on
    // render. Dead/legacy slugs still 301 to the catalogue so no link equity is
    // lost to a 404 and the visitor stays on-site.
    if (product) {
      let html;
      try {
        html = injectProductSeo(detailTemplate(), product);
      } catch (e) {
        // Never fail the page over an SEO-injection edge case — serve the
        // static file and let client-side applyMeta populate the head.
        return res.type('html').send(detailTemplate());
      }
      return res.type('html').send(html);
    }
  } catch (_) {
    // fall through to the catalogue
  }
  return res.redirect(301, '/product.html');
});

// Legacy category archives → the catalogue, pre-filtered where the name still
// matches a live category. product.html reads ?category=<name> (added earlier).
app.get(['/product-category/:slug', '/product-category/:slug/'], async (req, res) => {
  try {
    const Category = require('./models/Category');
    const slug = String(req.params.slug || '').toLowerCase();
    const cat = await Category.findOne({ categorySlug: slug }).select('categoryName').lean();
    if (cat && cat.categoryName) {
      return res.redirect(301, `/product.html?category=${encodeURIComponent(cat.categoryName)}`);
    }
  } catch (_) {
    // fall through to the catalogue
  }
  return res.redirect(301, '/product.html');
});

// ── SEO: robots.txt + sitemap.xml ───────────────────────────────────────────────
// Prefer a real public origin; fall back to the production domain (FRONTEND_URL
// defaults to localhost in dev, which is useless in a sitemap).
const SITE_URL = (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost'))
  ? process.env.FRONTEND_URL.replace(/\/$/, '')
  : 'https://www.fairfordpharma.com';

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    'User-agent: *\n' +
    'Allow: /\n' +
    // Keep private/authenticated surfaces out of the index.
    'Disallow: /superadmin.html\n' +
    'Disallow: /admin.html\n' +
    'Disallow: /retailer.html\n' +
    'Disallow: /distributor.html\n' +
    'Disallow: /api/\n\n' +
    `Sitemap: ${SITE_URL}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', async (_req, res) => {
  // Public, indexable pages only. login&signup.html is deliberately absent —
  // it carries noindex, so listing it here would contradict the page itself.
  // search.html and distributor.html were missing and are genuine landing pages.
  const pages = ['/', '/product.html', '/About.html', '/contactus.html', '/uphaar.html', '/nueva-vida.html',
                 '/registration.html', '/distributor.html', '/search.html',
                 '/privacy&policy.html', '/T&C.html'];
  // Page names contain literal & (login&signup.html etc.), which must be
  // XML-escaped inside <loc> or the sitemap is malformed.
  const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const staticUrls = pages
    .map(p => `  <url><loc>${xmlEsc(SITE_URL + (p === '/' ? '/' : p))}</loc></url>`);

  // Every active product as its clean /product/<slug> URL — these are the
  // catalogue's real landing pages and were previously absent from the sitemap,
  // leaving the entire product range undiscoverable through it. Each URL is the
  // 200-serving canonical set on the page itself.
  let productUrls = [];
  try {
    const products = await Product.find({ status: 'active' }).select('slug updatedAt').lean();
    productUrls = products
      .filter(p => p.slug)
      .map(p => {
        const loc = xmlEsc(`${SITE_URL}/product/${encodeURIComponent(p.slug)}`);
        const lastmod = p.updatedAt ? `<lastmod>${new Date(p.updatedAt).toISOString().slice(0, 10)}</lastmod>` : '';
        return `  <url><loc>${loc}</loc>${lastmod}</url>`;
      });
  } catch (_) {
    // DB unreachable → still serve the static-page sitemap rather than 500.
  }

  // Category landing pages — /product.html?category=<Name>, one per category
  // that has at least one active product (the self-canonical URL each category
  // view now renders). Same URLSearchParams encoding as the canonical.
  let categoryUrls = [];
  try {
    const counts = await getCategoryCounts();
    categoryUrls = Object.keys(counts)
      .filter(name => counts[name] > 0)
      .sort()
      .map(name => `  <url><loc>${xmlEsc(categoryUrl(name))}</loc></url>`);
  } catch (_) {
    // DB unreachable → omit category URLs.
  }

  const urls = staticUrls.concat(categoryUrls, productUrls).join('\n');
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls + '\n</urlset>\n'
  );
});

// ── 404 ───────────────────────────────────────────────────────────────────────
// API misses return JSON; a mistyped page URL gets a small HTML page instead of
// a raw JSON blob.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  res.status(404).type('html').send(
    '<!doctype html><meta charset="utf-8"><title>Page not found — Fair Ford Pharma</title>' +
    '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:18vh auto;text-align:center;color:#1a1f2b">' +
    '<h1 style="font-size:64px;margin:0;color:#002C5F">404</h1>' +
    '<p style="font-size:18px;margin:8px 0 4px">This page could not be found.</p>' +
    '<p style="color:#6b7482">It may have moved or the link is incorrect.</p>' +
    '<p style="margin-top:24px"><a href="/" style="color:#2f6cae;font-weight:600;text-decoration:none">&larr; Back to home</a></p>' +
    '</div>'
  );
});

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
app.use(errorMiddleware);

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  verifyMailTransport(); // non-blocking: warns if email is misconfigured
  app.listen(PORT, () => {
    console.log(`\n  Fair Ford Pharma API`);
    console.log(`  Server : http://localhost:${PORT}`);
    console.log(`  Env    : ${process.env.NODE_ENV || 'development'}\n`);
  });
};

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;

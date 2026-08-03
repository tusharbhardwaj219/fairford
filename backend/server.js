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
      // modal is blocked by CSP and never opens.
      scriptSrc:      ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://checkout.razorpay.com'],
      scriptSrcAttr:  ["'unsafe-inline'"], // inline onclick handlers used across the pages
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      fontSrc:        ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      imgSrc:         ["'self'", 'data:', 'https:'],
      // Checkout posts telemetry to lumberjack.* and talks to api.razorpay.com.
      connectSrc:     ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://lumberjack-metrics.razorpay.com'],
      // Razorpay renders its modal (and bank/UPI redirects) inside iframes.
      frameSrc:       ["'self'", 'https://www.google.com', 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
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

// Serve the frontend pages at the site root so clean page URLs resolve —
// /product.html, /login&signup.html, /retailer.html, /superadmin.html, etc.
// Previously only '/' was routed, so every other page (and the post-login
// redirect targets) returned the 404 JSON handler.
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'))
);

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

app.get('/sitemap.xml', (_req, res) => {
  const pages = ['/', '/product.html', '/About.html', '/contactus.html', '/uphaar.html',
                 '/registration.html', '/login&signup.html', '/privacy&policy.html', '/T&C.html'];
  // Page names contain literal & (login&signup.html etc.), which must be
  // XML-escaped inside <loc> or the sitemap is malformed.
  const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const urls = pages
    .map(p => `  <url><loc>${xmlEsc(SITE_URL + (p === '/' ? '/' : p))}</loc></url>`)
    .join('\n');
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

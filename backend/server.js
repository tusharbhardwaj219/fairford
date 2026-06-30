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

const app = express();

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
      scriptSrc:      ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      scriptSrcAttr:  ["'unsafe-inline'"], // inline onclick handlers used across the pages
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      fontSrc:        ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc:         ["'self'", 'data:', 'https:'],
      connectSrc:     ["'self'"],
      frameSrc:       ["'self'", 'https://www.google.com'], // contact-page Google Maps embed
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      frameAncestors: ["'self'"],
      formAction:     ["'self'"],
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
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'))
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' })
);

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
app.use(errorMiddleware);

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
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

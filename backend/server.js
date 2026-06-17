require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();

// ============ MIDDLEWARE ============

app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS Configuration for your frontend domain
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, same-origin) or null (file:// protocol)
    if (!origin || origin === 'null') return callback(null, true);

    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5000',
      'http://127.0.0.1:5000',
    ].filter(Boolean);

    if (allowed.includes(origin)) return callback(null, true);

    // In development, allow any localhost/127.0.0.1 port
    if (
      process.env.NODE_ENV === 'development' &&
      (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))
    ) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Sanitize MongoDB query injection
app.use(mongoSanitize());

// Rate Limiting - Prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============ DATABASE CONNECTION ============

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ Database Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

// ============ SWAGGER DOCS ============

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Fair Ford Pharmaceuticals API',
            version: '1.0.0',
            description: 'B2B Pharmaceutical platform REST API documentation',
            contact: { name: 'Fair Ford Pharmaceuticals', email: 'info@fairfordpharma.com' },
        },
        servers: [{ url: `http://localhost:${process.env.PORT || 5000}`, description: 'Development server' }],
    },
    apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

// ============ ROUTES ============

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Import Route Controllers
const authRoutes         = require('./routes/authRoutes');
const newsletterRoutes   = require('./routes/newsletter');
const productRoutes      = require('./routes/productRoutes');
const categoryRoutes     = require('./routes/categoryRoutes');
const contactRoutes      = require('./routes/contactRoutes');
const distributorRoutes  = require('./routes/distributorRoutes');
const retailerRoutes     = require('./routes/retailerRoutes');
const dashboardApiRoutes = require('./routes/dashboardApiRoutes');

// Mount Routes
// Dashboard panel routes must come BEFORE product/retailer routers so that
// specific paths like /api/products/top and /api/retailer (root) are matched
// first; unmatched paths fall through to the existing routers.
app.use('/api',             dashboardApiRoutes);
app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/newsletter',  newsletterRoutes);
app.use('/api/products',    productRoutes);
app.use('/api/categories',  categoryRoutes);
app.use('/api/contact',     contactRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/retailer',    retailerRoutes);

// ============ STATIC FILES ============

// Serve frontend assets (css, js, images) under /frontend/
app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));

// Serve HTML pages from frontend/public at the root URL
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Home Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});


// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { error: err })
  });
});

// ============ SERVER START ============

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start server
    app.listen(PORT, () => {
      console.log('server is running on port 5000'
      // ╔════════════════════════════════════════════════╗
      // ║   Fair Ford Pharmaceuticals Backend Server      ║
      // ║   Server running on: http://localhost:${PORT}    ║
      // ║   Environment: ${process.env.NODE_ENV || 'development'}║
      // ╚════════════════════════════════════════════════╝
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;


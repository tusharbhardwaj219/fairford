const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // Log every 5xx server-side (stdout → Cloud Run logs). The client response
  // below still hides internals in production; this only makes the failure
  // visible to operators, which it previously was NOT (a silent 500 with no
  // trace anywhere). 4xx are client faults and stay quiet to avoid log noise.
  if ((err.statusCode || 500) >= 500) {
    console.error('[error]', req.method, req.originalUrl, '→', err && (err.stack || err.message || err));
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
    return res.status(statusCode).json({ success: false, message, errors: err.errors });
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    return res.status(statusCode).json({ success: false, message });
  }

  if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token' });
  if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'Token has expired' });
  if (err.name === 'CastError')          return res.status(400).json({ success: false, message: 'Invalid ID format' });

  // Don't leak raw internal error text on unexpected 5xx errors in production —
  // it can expose stack frames, driver messages, and query internals.
  const isDev = process.env.NODE_ENV === 'development';
  if (statusCode >= 500 && !isDev) message = 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;

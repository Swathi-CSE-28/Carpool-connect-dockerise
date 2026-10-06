// Centralized error handler. Never leaks stack traces or secrets in production.
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';

  if (statusCode === 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && isProd ? 'Something went wrong on our end' : err.message,
    ...(isProd ? {} : { stack: err.stack })
  });
};

const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};

module.exports = { errorHandler, notFound };

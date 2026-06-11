const AppError = require('../utils/appError');

const isDev = process.env.NODE_ENV === 'development';

module.exports = (err, req, res, next) => {
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'fail',
      code: 'VALIDATION_ERROR',
      fields: Object.keys(err.errors),
    });
  }

  // Duplicate key
  if (err.code === 11000) {
    return res.status(409).json({ status: 'fail', code: 'DUPLICATE_KEY' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ status: 'fail', code: 'INVALID_TOKEN' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ status: 'fail', code: 'TOKEN_EXPIRED' });
  }

  // Custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      code: err.code,
      // show message in dev only
      ...(isDev && { message: err.message, stack: err.stack }),
    });
  }

  // Unknown errors
  console.error('Unhandled error:', err); // stays server-side only ✅

  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    // show stack in dev only
    ...(isDev && { message: err.message, stack: err.stack }),
  });
};

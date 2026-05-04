const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const globalErrorHandler = require('./controllers/errorController');
const AppError = require('./utils/appError');

const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const storeRouter = require('./routes/storeRoutes');
const warehouseRouter = require('./routes/warehouseRoutes');
const transactionRouter = require('./routes/transactionRoutes');
const deliveryRouter = require('./routes/deliveryRoutes');

const app = express();

// ✅ Security HTTP headers
app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ✅ Rate limiting — max 100 requests per hour per IP
const limiter = rateLimit({
  max: process.env.NODE_ENV === 'development' ? 10000 : 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10kb' })); // limit body size to 10kb
app.set('query parser', 'extended');

// Cookie Parser
app.use(cookieParser());

// Data sanitization against NoSQL injection
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach((key) => {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      });
    }
  };

  sanitize(req.body);
  sanitize(req.params);
  next();
});

app.use((req, res, next) => {
  next();
});
// Data sanitization against XSS
app.use((req, res, next) => {
  if (req.body) {
    const sanitizeXSS = (obj) => {
      if (typeof obj === 'string') return xss(obj);
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach((key) => {
          obj[key] = sanitizeXSS(obj[key]);
        });
      }
      return obj;
    };
    req.body = sanitizeXSS(req.body);
  }
  next();
});

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ['price', 'quantity', 'category'], // allow duplicates for these
  })
);

// Routes
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/stores', storeRouter);
app.use('/api/v1/warehouses', warehouseRouter);
app.use('/api/v1/transactions', transactionRouter);
app.use('/api/v1/deliveries', deliveryRouter);

// Handle undefined routes
app.all('*splat', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler - must be last
app.use(globalErrorHandler);

module.exports = app;

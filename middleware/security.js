const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply security middleware
const setupSecurity = (app) => {
  // Set security HTTP headers
  app.use(helmet());
  
  // Enable CORS
  app.use(cors());
  
  // Rate limiting
  app.use('/api/', apiLimiter);
  
  return app;
};

module.exports = setupSecurity; 
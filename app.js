const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const errorHandler = require('./middleware/error');
const cookieParser = require('cookie-parser');
const setupSecurity = require('./middleware/security');
const requestLogger = require('./middleware/requestLogger');

// Initialize express app
const app = express();

// Apply security middleware
setupSecurity(app);

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Set static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Disable express default error handler
app.set('x-powered-by', false);

// Add headers middleware
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Route imports (will create these in the next steps)
const documentRoutes = require('./Routes/documents');
const conversationRoutes = require('./Routes/conversations');
const voiceRoutes = require('./Routes/voice');
const authRoutes = require('./Routes/auth');
const reportRoutes = require('./Routes/reports');

// Auth routes (no logging required)
app.use('/api/auth', authRoutes);

// Add request logger middleware after auth routes
// but before other routes that need logging
app.use(requestLogger);

// Mount routes
app.use('/api/documents', documentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/reports', reportRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to KAIE' });
});

// Error handler must be last
app.use(errorHandler);

// Add this before your server definition (line 68)
const PORT = process.env.PORT || 3000;

// Now this line will work
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Then your error handlers can use it
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app; 
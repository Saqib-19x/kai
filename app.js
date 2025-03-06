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

// Route imports (will create these in the next steps)
const documentRoutes = require('./routes/documents');
const conversationRoutes = require('./routes/conversations');
const voiceRoutes = require('./routes/voice');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');

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
  res.json({ message: 'Welcome to AI Document Processor API' });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app; 
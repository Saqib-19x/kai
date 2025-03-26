const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
dotenv.config();

// Create express app instance
const app = require('./app');

// Set strictQuery to suppress the warning
mongoose.set('strictQuery', false);

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Connect to the database
connectDB();

// Create upload directory if it doesn't exist
const fs = require('fs');
const uploadDir = process.env.FILE_UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set port
const PORT = process.env.PORT || 3000;

// Include this with your other route imports
const agentRoutes = require('./routes/agents');
const publicRoutes = require('./routes/public');
const voiceAgentRoutes = require('./routes/voiceAgentRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Add this with your other route registrations
app.use('/api/agents', agentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/voice-agents', voiceAgentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Serve embed script statically
app.use(express.static('public'));

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server and exit process
  server.close(() => process.exit(1));
});

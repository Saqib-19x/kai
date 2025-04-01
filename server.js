const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');

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

// Include this with your other route imports
const agentRoutes = require('./Routes/agents');
const publicRoutes = require('./Routes/public');
const voiceAgentRoutes = require('./Routes/voiceAgentRoutes');
const webhookRoutes = require('./Routes/webhookRoutes');

// Add this with your other route registrations
app.use('/api/agents', agentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/voice-agents', voiceAgentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Serve embed script statically
app.use(express.static('public'));

// Start the server with port fallback
function startServer(port) {
  const defaultPort = port || process.env.PORT || 3000;
  
  const server = http.createServer(app);
  
  server.listen(defaultPort);
  
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${defaultPort} is busy, trying ${defaultPort + 1}...`);
      startServer(defaultPort + 1);
    } else {
      console.error(e);
    }
  });
  
  server.on('listening', () => {
    console.log(`Server running on port ${server.address().port}`);
  });
  
  return server;
}

const server = startServer();

// Handle graceful shutdown
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

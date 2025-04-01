const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  // Log for development
  console.log('Error name:', err.name);
  console.log('Error stack:', err.stack);

  // Force JSON response type and prevent any HTML responses
  res.setHeader('Content-Type', 'application/json');

  // Handle CastError (invalid MongoDB ObjectId)
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    err = new ErrorResponse(message, 400);
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    err = new ErrorResponse(message, 400);
  }

  // Handle Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    err = new ErrorResponse(message, 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    err = new ErrorResponse('Invalid token', 401);
  }

  // Handle JWT expiry
  if (err.name === 'TokenExpiredError') {
    err = new ErrorResponse('Token expired', 401);
  }

  // If it's our custom error, use it directly
  if (err instanceof ErrorResponse) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // For any other error, create a new ErrorResponse
  const error = new ErrorResponse(
    err.message || 'Server Error',
    err.statusCode || 500
  );

  // Send the response
  res.status(error.statusCode).json(error.toJSON());
};

// Handle uncaught promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥');
  console.log(err.name, err.message);
  console.log('Stack:', err.stack);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥');
  console.log(err.name, err.message);
  console.log('Stack:', err.stack);
});

module.exports = errorHandler; 
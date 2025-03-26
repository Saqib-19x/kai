const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log for development
  console.log('Error stack:', err.stack);

  // Force JSON response type
  res.setHeader('Content-Type', 'application/json');

  // Handle different types of errors
  if (err instanceof ErrorResponse) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode
      }
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: {
        message,
        statusCode: 400
      }
    });
  }

  // Handle Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Duplicate field value entered',
        statusCode: 400
      }
    });
  }

  // Default error
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Server Error',
      statusCode: error.statusCode || 500
    }
  });
};

module.exports = errorHandler; 
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = errorHandler; 
const User = require('../models/User');
const asyncHandler = require('../middleware/async');
const crypto = require('crypto');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role
  });

  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide an email and password'
    });
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  // Use secure cookies in production
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      role: user.role
    });
};

// @desc    Generate API key
// @route   POST /api/auth/api-keys
// @access  Private
exports.generateApiKey = asyncHandler(async (req, res, next) => {
  const { name } = req.body;
  
  // Generate API key with prefix for better identification
  const prefix = 'pk_';
  const randomKey = crypto.randomBytes(24).toString('hex');
  const apiKey = `${prefix}${randomKey}`;
  
  // Add API key to user's API keys
  const user = await User.findById(req.user.id);
  
  // Limit number of active API keys (optional)
  if (user.apiKeys.length >= 5) {
    return res.status(400).json({
      success: false,
      error: 'Maximum number of API keys (5) reached. Please revoke an existing key first.'
    });
  }

  user.apiKeys.push({
    name: name || 'API Key',
    key: apiKey,
    createdAt: new Date(),
    lastUsed: null
  });

  await user.save();

  res.status(201).json({
    success: true,
    data: {
      name: name || 'API Key',
      key: apiKey,
      createdAt: new Date()
    }
  });
});

// @desc    List all API keys
// @route   GET /api/auth/api-keys
// @access  Private
exports.listApiKeys = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  res.status(200).json({
    success: true,
    count: user.apiKeys.length,
    data: user.apiKeys.map(apiKey => ({
      id: apiKey._id,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
      lastUsed: apiKey.lastUsed,
      // Only show last 4 characters of the key
      keyPreview: `pk_...${apiKey.key.slice(-4)}`
    }))
  });
});

// @desc    Revoke API key
// @route   DELETE /api/auth/api-keys/:keyId
// @access  Private
exports.revokeApiKey = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  user.apiKeys = user.apiKeys.filter(
    key => key._id.toString() !== req.params.keyId
  );
  
  await user.save();

  res.status(200).json({
    success: true,
    data: {}
  });
}); 
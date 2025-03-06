const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = process.env.FILE_UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  // Accept images, PDFs and text files
  if (
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'text/plain' ||
    file.mimetype.startsWith('image/')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload PDF, text, or image files.'), false);
  }
};

// Create the multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // Default to 5MB
  },
  fileFilter: fileFilter
});

module.exports = upload; 
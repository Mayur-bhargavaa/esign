const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, 'storage', 'templates'),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
    return;
  }

  cb(new Error('Only PDF files are allowed'));
};

const upload = multer({ storage, fileFilter });

module.exports = upload;

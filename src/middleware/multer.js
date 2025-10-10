const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    // keep original extension but make filename unique
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

// Accept common image types only (adjust as needed)
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
function fileFilter(req, file, cb) {
  if (imageMimeTypes.includes(file.mimetype)) return cb(null, true);
  const err = new Error('Only image files are allowed');
  err.status = 415;
  return cb(err);
}

const limits = {
  fileSize: 5 * 1024 * 1024, // 5 MB per file
};

const upload = multer({ storage, fileFilter, limits });

// Helper wrappers to keep controllers concise
exports.upload = upload; // raw multer instance if needed
exports.uploadSingle = (fieldName) => upload.single(fieldName);
exports.uploadArray = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);
exports.uploadFields = (fields) => upload.fields(fields);
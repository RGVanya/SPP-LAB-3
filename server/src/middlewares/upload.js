const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

function createUpload({ uploadsDir, maxUploadBytes }) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(uploadsDir, req.params.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const extension = path.extname(path.basename(file.originalname)).slice(0, 16);
      cb(null, `${crypto.randomUUID()}${extension}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxUploadBytes, files: 1 },
    // Браузер передаёт имя файла в UTF-8. Иначе кириллица сохраняется как latin1.
    defParamCharset: 'utf8',
  });
}

module.exports = { createUpload };

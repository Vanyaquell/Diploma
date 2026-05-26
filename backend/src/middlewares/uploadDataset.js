const fs = require("node:fs");
const path = require("node:path");

const multer = require("multer");

const { adminDatasetsDir, ensureAdminMlDirectories } = require("../services/adminMlPaths");
const HttpError = require("../utils/httpError");

ensureAdminMlDirectories();

const temporaryUploadsDir = path.join(adminDatasetsDir, "_tmp");
fs.mkdirSync(temporaryUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, temporaryUploadsDir);
  },
  filename(_req, file, callback) {
    const extension = path.extname(file.originalname || ".xlsx") || ".xlsx";
    callback(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}${extension}`);
  },
});

function fileFilter(_req, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (extension !== ".csv" && extension !== ".xlsx") {
    callback(new HttpError(400, "Можно загружать только файлы XLSX или CSV."));
    return;
  }

  callback(null, true);
}

const uploadDataset = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = uploadDataset;

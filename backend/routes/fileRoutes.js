const express = require("express");
const multer = require("multer");
const { extract } = require("../controllers/fileController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

router.post("/files/extract", upload.single("file"), extract);

module.exports = router;

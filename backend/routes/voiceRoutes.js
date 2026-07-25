const express = require("express");
const multer = require("multer");
const { transcribe, speak } = require("../controllers/voiceController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = express.Router();

router.post("/voice/transcribe", upload.single("audio"), transcribe);
router.post("/voice/speak", speak);

module.exports = router;

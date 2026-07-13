const express = require("express");
const {
  listConversations,
  getConversation,
  createConversation,
  addMessage,
} = require("../controllers/conversationController");

const router = express.Router();

router.get("/conversations", listConversations);
router.get("/conversations/:id", getConversation);
router.post("/conversations", createConversation);
router.post("/conversations/:id/messages", addMessage);

module.exports = router;

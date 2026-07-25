const express = require("express");
const {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  addMessage,
} = require("../controllers/conversationController");

const router = express.Router();

router.get("/conversations", listConversations);
router.get("/conversations/:id", getConversation);
router.post("/conversations", createConversation);
router.delete("/conversations/:id", deleteConversation);
router.post("/conversations/:id/messages", addMessage);

module.exports = router;

const express = require("express");
const {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  addMessage,
  editMessage,
} = require("../controllers/conversationController");

const router = express.Router();

router.get("/conversations", listConversations);
router.get("/conversations/:id", getConversation);
router.post("/conversations", createConversation);
router.delete("/conversations/:id", deleteConversation);
router.post("/conversations/:id/messages", addMessage);
router.put("/conversations/:id/messages/:index", editMessage);

module.exports = router;

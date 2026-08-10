const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const Admin = require("../models/Admin");
const Conversation = require("../models/Conversation");
const Visit = require("../models/Visit");

async function verifyAdminCredentials(email, password) {
  const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
  if (!admin) return null;

  const valid = await bcrypt.compare(password, admin.passwordHash);
  return valid ? admin : null;
}

function issueToken(admin) {
  return jwt.sign({ sub: admin._id.toString() }, env.jwtSecret, { expiresIn: env.adminTokenTtl });
}

async function getSummary() {
  const [userIds, conversationCount, messageAgg, visitCount, ipAgg] = await Promise.all([
    Conversation.distinct("sessionToken"),
    Conversation.countDocuments(),
    Conversation.aggregate([
      { $project: { count: { $size: "$messages" } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]),
    Visit.countDocuments(),
    Visit.distinct("ip"),
  ]);

  return {
    totalUsers: userIds.filter(Boolean).length,
    totalConversations: conversationCount,
    totalMessages: messageAgg[0]?.total || 0,
    totalVisits: visitCount,
    uniqueIps: ipAgg.filter(Boolean).length,
  };
}

async function getVisits({ page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;
  const [visits, total] = await Promise.all([
    Visit.find({}, "ip path method sessionToken userAgent createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Visit.countDocuments(),
  ]);

  return { visits, total, page, limit };
}

async function getUniqueIps({ page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;

  const [ips, totalAgg] = await Promise.all([
    Visit.aggregate([
      { $match: { ip: { $ne: "" } } },
      {
        $group: {
          _id: "$ip",
          visitCount: { $sum: 1 },
          firstSeen: { $min: "$createdAt" },
          lastSeen: { $max: "$createdAt" },
        },
      },
      { $sort: { visitCount: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _id: 0, ip: "$_id", visitCount: 1, firstSeen: 1, lastSeen: 1 } },
    ]),
    Visit.aggregate([
      { $match: { ip: { $ne: "" } } },
      { $group: { _id: "$ip" } },
      { $count: "total" },
    ]),
  ]);

  return { ips, total: totalAgg[0]?.total || 0, page, limit };
}

async function getActivity({ days = 14 }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const activity = await Conversation.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $project: {
        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        messageCount: { $size: "$messages" },
      },
    },
    {
      $group: {
        _id: "$day",
        conversations: { $sum: 1 },
        messages: { $sum: "$messageCount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return activity.map((a) => ({ day: a._id, conversations: a.conversations, messages: a.messages }));
}

module.exports = {
  verifyAdminCredentials,
  issueToken,
  getSummary,
  getVisits,
  getUniqueIps,
  getActivity,
};

const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error("Usage: node backend/scripts/seedAdmin.js <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  await connectDB();

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.toLowerCase().trim();

  await Admin.findOneAndUpdate(
    { email: normalizedEmail },
    { email: normalizedEmail, passwordHash },
    { upsert: true, new: true }
  );

  console.log(`Admin account ready for ${normalizedEmail}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed admin:", err.message);
  process.exit(1);
});

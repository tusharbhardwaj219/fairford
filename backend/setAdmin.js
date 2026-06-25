/* =====================================================================
   setAdmin.js — create or update an admin login (no DB wipe)

   Usage:
     node setAdmin.js <email> <password> [name]

   Examples:
     node setAdmin.js admin@fairford.in MyStrongPass@123
     node setAdmin.js admin@fairford.in MyStrongPass@123 "Ops Admin"

   If the email already exists, its password is reset; otherwise a new
   superadmin is created. Password is hashed by the Admin pre-save hook.
   ===================================================================== */

require('dotenv').config();
const connectDB = require('./config/database');
const Admin = require('./models/Admin');

(async () => {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const password = process.argv[3];
  const name = process.argv[4] || 'Super Admin';

  if (!email || !password) {
    console.error('Usage: node setAdmin.js <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  await connectDB();

  let admin = await Admin.findOne({ email }).select('+password');
  if (admin) {
    admin.password = password;          // pre-save hook hashes it
    admin.isActive = true;
    await admin.save();
    console.log(`\n✓  Updated admin password for ${email}`);
  } else {
    admin = await Admin.create({ name, email, password, role: 'superadmin', isActive: true });
    console.log(`\n✓  Created superadmin ${email}`);
  }

  console.log(`   Login at /admin.html →  ${email}  /  ${password}\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});

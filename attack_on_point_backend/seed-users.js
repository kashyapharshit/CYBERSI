require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const accounts = [
  {
    envPrefix: 'BOOTSTRAP_ADMIN',
    role: 'admin',
    fallbackName: 'CISO Admin'
  },
  {
    envPrefix: 'BOOTSTRAP_ANALYST',
    role: 'analyst',
    fallbackName: 'Security Analyst'
  },
  {
    envPrefix: 'BOOTSTRAP_VIEWER',
    role: 'viewer',
    fallbackName: 'Board Viewer'
  }
];

const run = async () => {
  const missing = accounts.flatMap(({ envPrefix }) => [
    `${envPrefix}_EMAIL`,
    `${envPrefix}_PASSWORD`
  ]).filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing bootstrap environment values: ${missing.join(', ')}`);
  }

  await mongoose.connect(process.env.MONGO_URI);

  for (const account of accounts) {
    const email = process.env[`${account.envPrefix}_EMAIL`].toLowerCase().trim();
    const password = process.env[`${account.envPrefix}_PASSWORD`];
    const passwordHash = await bcrypt.hash(password, 12);

    await User.findOneAndUpdate(
      { email },
      {
        name: process.env[`${account.envPrefix}_NAME`] || account.fallbackName,
        email,
        password: passwordHash,
        role: account.role
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[Users] ${account.role} account provisioned: ${email}`);
  }

  await mongoose.disconnect();
  console.log('[Users] Bootstrap completed. Remove bootstrap password values after use.');
};

run().catch(async (error) => {
  console.error(`[Users] Bootstrap failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

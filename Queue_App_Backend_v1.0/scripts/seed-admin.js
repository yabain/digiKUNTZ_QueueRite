#!/usr/bin/env node

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw Error('MONGODB_URI required');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // Create or find establishment
  const establishments = db.collection('establishments');
  let e = await establishments.findOne({ code: 'MAIN' });
  if (!e) {
    const r = await establishments.insertOne({
      name: process.env.ESTABLISHMENT_NAME || 'Queue App Demo',
      code: 'MAIN',
      timezone: 'Africa/Douala',
      locale: 'fr',
      operationalDayStart: '00:00',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    e = { _id: r.insertedId };
  }

  // Create or find admin user
  const username = process.env.ADMIN_USERNAME || 'admin';
  const users = db.collection('users');

  if (!(await users.findOne({ username, establishmentId: e._id }))) {
    const passwordHash = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'admin123',
      12
    );
    await users.insertOne({
      establishmentId: e._id,
      username,
      displayName: process.env.ADMIN_NAME || 'Administrateur',
      passwordHash,
      role: 'admin',
      active: true,
      preferredLocale: 'fr',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Admin created. Change the password immediately.');
  } else {
    console.log('Admin already exists.');
  }

  await mongoose.disconnect();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
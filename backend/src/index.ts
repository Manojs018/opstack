import * as dotenv from 'dotenv';
// Load environment variables before importing app
dotenv.config();

import app from './app';
import prisma from './db';
import { seedDatabase } from './seedHelper';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`[Server]: Mini ERP backend listening on port ${PORT}`);
  
  // Auto-seed fresh database if empty
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Server]: 0 users found in database. Initializing auto-seed...');
      await seedDatabase();
      console.log('[Server]: Auto-seed completed successfully!');
    }
  } catch (err) {
    console.error('[Server]: Database connection or auto-seed error:', err);
  }
});

process.on('SIGTERM', () => {
  console.log('[Server]: SIGTERM received. Shutting down gracefully.');
  server.close(() => {
    console.log('[Server]: Process terminated.');
  });
});

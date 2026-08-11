import * as dotenv from 'dotenv';
// Load environment variables before importing app
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[Server]: Mini ERP backend listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[Server]: SIGTERM received. Shutting down gracefully.');
  server.close(() => {
    console.log('[Server]: Process terminated.');
  });
});

import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';

import authRouter from './routes/auth';
import customersRouter from './routes/customers';
import productsRouter from './routes/products';
import purchaseOrdersRouter from './routes/purchaseOrders';
import salesChallansRouter from './routes/salesChallans';
import invoicesRouter from './routes/invoices';
import followupsRouter from './routes/followups';
import dashboardRouter from './routes/dashboard';
import stockMovementsRouter from './routes/stockMovements';

const app = express();

// Flexible CORS Configuration for local & production deployment
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (
        !corsOrigin ||
        corsOrigin === '*' ||
        corsOrigin === origin ||
        origin.endsWith('.onrender.com') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }

      const allowed = corsOrigin.split(',').map((s) => s.trim());
      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      // Default allow to prevent deployment lockout
      callback(null, true);
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/sales-challans', salesChallansRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/followups', followupsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/stock-movements', stockMovementsRouter);

// Centralized error handler
app.use(errorHandler);

export default app;

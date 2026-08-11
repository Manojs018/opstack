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

// Configure CORS
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

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

import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { validate } from '../middleware/validate';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role, PaymentStatus } from '@prisma/client';

const router = Router();

const querySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    customerId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
    status: z.nativeEnum(PaymentStatus).optional(),
    startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

const paymentStatusSchema = z.object({
  body: z.object({
    paymentStatus: z.nativeEnum(PaymentStatus),
  }),
});

const invoiceItemSchema = z.object({
  productId: z.number().int().positive('Product ID must be positive'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unitPrice: z.number().positive('Unit price must be positive'),
});

const invoiceCreateSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID must be positive'),
    dueDate: z.string().transform((val) => new Date(val)),
    items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  }),
});

// List invoices with pagination and filters (Admin, Accounts, Sales)
router.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.ACCOUNTS, Role.SALES]),
  validate(querySchema),
  async (req: AuthRequest, res: Response, next) => {
    const { page, limit, customerId, status, startDate, endDate } = req.query as any;
    const skip = (page - 1) * limit;

    try {
      const where: any = {};
      if (customerId) {
        where.customerId = customerId;
      }
      if (status) {
        where.paymentStatus = status;
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const [data, total] = await prisma.$transaction([
        prisma.invoice.findMany({
          where,
          include: {
            customer: {
              select: { name: true, companyName: true }
            }
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        data,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single Invoice details
router.get(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.ACCOUNTS, Role.SALES]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          salesChallan: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
      if (!invoice) {
        return res.status(404).json({ error: { message: 'Invoice not found' } });
      }
      return res.status(200).json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

// Create Standalone Invoice (Admin, Accounts)
router.post(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.ACCOUNTS]),
  validate(invoiceCreateSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { customerId, dueDate, items } = req.body;
    try {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(400).json({ error: { message: 'Customer does not exist', field: 'customerId' } });
      }

      const count = await prisma.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
      const tax = parseFloat((subtotal * 0.18).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      const newInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId,
          dueDate,
          subtotal,
          tax,
          total,
          paymentStatus: PaymentStatus.UNPAID,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });

      return res.status(201).json(newInvoice);
    } catch (error) {
      next(error);
    }
  }
);

// Update Invoice Payment Status (Admin, Accounts only)
router.patch(
  '/:id/payment-status',
  authenticate,
  requireRole([Role.ADMIN, Role.ACCOUNTS]),
  validate(idParamSchema.merge(paymentStatusSchema)),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    const { paymentStatus } = req.body;
    try {
      const updated = await prisma.invoice.update({
        where: { id },
        data: { paymentStatus },
      });
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

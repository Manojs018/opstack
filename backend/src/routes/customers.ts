import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { validate } from '../middleware/validate';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role, CustomerType, CustomerStatus } from '@prisma/client';

const router = Router();

const querySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
    status: z.string().optional(),
    customerType: z.string().optional(),
  }),
});

const customerBodySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    companyName: z.string().min(1, 'Company name is required'),
    phone: z.string().min(1, 'Phone is required'),
    email: z.string().email('Invalid email address'),
    billingAddress: z.string().min(1, 'Billing address is required'),
    shippingAddress: z.string().min(1, 'Shipping address is required'),
    gstin: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    customerType: z.nativeEnum(CustomerType).optional().default(CustomerType.RETAIL),
    status: z.nativeEnum(CustomerStatus).optional().default(CustomerStatus.LEAD),
    followUpDate: z.string().optional().nullable().transform((val) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }),
  }),
});

const notesBodySchema = z.object({
  body: z.object({
    notes: z.string().nullable(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

// List customers with search, status filter, and pagination (Admin, Sales, Accounts)
router.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.ACCOUNTS]),
  validate(querySchema),
  async (req: AuthRequest, res: Response, next) => {
    const { page, limit, search, status, customerType } = req.query as any;
    const skip = (page - 1) * limit;

    try {
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (status && Object.values(CustomerStatus).includes(status as CustomerStatus)) {
        where.status = status as CustomerStatus;
      }

      if (customerType && Object.values(CustomerType).includes(customerType as CustomerType)) {
        where.customerType = customerType as CustomerType;
      }

      const [data, total] = await prisma.$transaction([
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.customer.count({ where }),
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

// Get single customer with followups
router.get(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.ACCOUNTS]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          followups: {
            orderBy: { dueDate: 'desc' },
            take: 10,
            include: { assignedTo: { select: { name: true } } },
          },
          _count: {
            select: {
              salesChallans: true,
              invoices: true,
              followups: true,
            },
          },
        },
      });
      if (!customer) {
        return res.status(404).json({ error: { message: 'Customer not found' } });
      }
      return res.status(200).json(customer);
    } catch (error) {
      next(error);
    }
  }
);

// Create customer (Admin, Sales)
router.post(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(customerBodySchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const newCustomer = await prisma.customer.create({
        data: req.body,
      });
      return res.status(201).json(newCustomer);
    } catch (error) {
      next(error);
    }
  }
);

// Update customer (Admin, Sales)
router.put(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(idParamSchema.merge(customerBodySchema)),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const updatedCustomer = await prisma.customer.update({
        where: { id },
        data: req.body,
      });
      return res.status(200).json(updatedCustomer);
    } catch (error) {
      next(error);
    }
  }
);

// Patch notes only (for quick inline note editing from detail panel)
router.patch(
  '/:id/notes',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(idParamSchema.merge(notesBodySchema)),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const updated = await prisma.customer.update({
        where: { id },
        data: { notes: req.body.notes },
      });
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete customer (Admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      await prisma.customer.delete({
        where: { id },
      });
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

export default router;

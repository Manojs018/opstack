import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { validate } from '../middleware/validate';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

const querySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
    lowStock: z.string().optional().transform((val) => val === 'true'),
  }),
});

const productCreateSchema = z.object({
  body: z.object({
    sku: z.string().min(1, 'SKU is required'),
    name: z.string().min(1, 'Name is required'),
    category: z.string().min(1, 'Category is required'),
    unit: z.string().min(1, 'Unit is required'),
    price: z.number().positive('Price must be positive'),
    reorderLevel: z.number().int().nonnegative('Reorder level must be non-negative'),
    location: z.string().optional().nullable(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

const stockAdjustmentSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
  body: z.object({
    quantity: z.number().int().positive('Quantity must be a positive integer'),
    type: z.enum(['IN', 'OUT'], { required_error: 'Type must be IN or OUT' }),
    reason: z.string().min(1, 'Reason is required'),
  }),
});

// ─── List Products ────────────────────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS]),
  validate(querySchema),
  async (req: AuthRequest, res: Response, next) => {
    const { page, limit, search, lowStock } = req.query as any;
    const skip = (page - 1) * limit;

    try {
      const where: any = {};
      if (search) {
        where.OR = [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ];
      }

      let data: any[];
      let total: number;

      if (lowStock) {
        const allProducts = await prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });
        const filtered = allProducts.filter((p) => p.currentStock <= p.reorderLevel);
        total = filtered.length;
        data = filtered.slice(skip, skip + limit);
      } else {
        const [dbData, dbTotal] = await prisma.$transaction([
          prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
          prisma.product.count({ where }),
        ]);
        data = dbData;
        total = dbTotal;
      }

      const totalPages = Math.ceil(total / limit);
      return res.status(200).json({ data, meta: { total, page, limit, totalPages } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Get Single Product (with movement log) ───────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          stockMovements: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: {
              createdBy: { select: { name: true, role: true } },
            },
          },
        },
      });
      if (!product) {
        return res.status(404).json({ error: { message: 'Product not found' } });
      }
      return res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  }
);

// ─── Create Product ───────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE]),
  validate(productCreateSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const newProduct = await prisma.product.create({
        data: { ...req.body, currentStock: 0 },
      });
      return res.status(201).json(newProduct);
    } catch (error) {
      next(error);
    }
  }
);

// ─── Update Product Details ───────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE]),
  validate(idParamSchema.merge(productCreateSchema)),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: req.body,
      });
      return res.status(200).json(updatedProduct);
    } catch (error) {
      next(error);
    }
  }
);

// ─── Manual Stock Adjustment ──────────────────────────────────────────────────
router.post(
  '/:id/stock-adjustment',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE]),
  validate(stockAdjustmentSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    const { quantity, type, reason } = req.body;

    try {
      // Check product exists and has sufficient stock for OUT movements
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ error: { message: 'Product not found' } });
      }

      if (type === 'OUT' && product.currentStock < quantity) {
        return res.status(400).json({
          error: {
            message: `Insufficient stock. Available: ${product.currentStock} ${product.unit}, requested: ${quantity} ${product.unit}`,
          },
        });
      }

      const stockDelta = type === 'IN' ? quantity : -quantity;

      // Run as a transaction: update stock + create movement log
      const [updatedProduct, movement] = await prisma.$transaction([
        prisma.product.update({
          where: { id },
          data: { currentStock: { increment: stockDelta } },
        }),
        prisma.stockMovement.create({
          data: {
            productId: id,
            quantity,
            type,
            referenceType: 'MANUAL',
            reason,
            createdById: req.user?.id ?? null,
          },
        }),
      ]);

      return res.status(200).json({
        product: updatedProduct,
        movement,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

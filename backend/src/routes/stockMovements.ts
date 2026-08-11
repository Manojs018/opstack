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
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
    search: z.string().optional(),       // search by product name or SKU
    type: z.string().optional(),         // IN | OUT
    productId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  }),
});

// ─── GET /api/stock-movements ─────────────────────────────────────────────────
// Returns paginated stock movements with product + createdBy details
router.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS]),
  validate(querySchema),
  async (req: AuthRequest, res: Response, next) => {
    const { page, limit, search, type, productId } = req.query as any;
    const skip = (page - 1) * limit;

    try {
      const where: any = {};

      // Filter by movement type (IN / OUT)
      if (type && (type === 'IN' || type === 'OUT')) {
        where.type = type;
      }

      // Filter by specific product ID
      if (productId) {
        where.productId = productId;
      }

      // Search by product name or SKU
      if (search) {
        where.product = {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        };
      }

      const [movements, total] = await prisma.$transaction([
        prisma.stockMovement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              select: { id: true, sku: true, name: true, unit: true, category: true },
            },
            createdBy: {
              select: { id: true, name: true, role: true },
            },
          },
        }),
        prisma.stockMovement.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        data: movements,
        meta: { total, page, limit, totalPages },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

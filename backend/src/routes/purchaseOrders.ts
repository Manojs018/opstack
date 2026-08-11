import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { validate } from '../middleware/validate';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role, POStatus } from '@prisma/client';

const router = Router();

const purchaseOrderItemSchema = z.object({
  productId: z.number().int().positive('Product ID must be positive'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unitCost: z.number().positive('Unit cost must be positive'),
});

const purchaseOrderCreateSchema = z.object({
  body: z.object({
    supplierName: z.string().min(1, 'Supplier name is required'),
    poDate: z.string().transform((val) => new Date(val)),
    status: z.nativeEnum(POStatus).optional().default(POStatus.DRAFT),
    items: z.array(purchaseOrderItemSchema).min(1, 'At least one line item is required'),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

// List Purchase Orders (Admin, Warehouse, Accounts)
router.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE, Role.ACCOUNTS]),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const orders = await prisma.purchaseOrder.findMany({
        include: {
          items: {
            include: {
              product: {
                select: { sku: true, name: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(orders);
    } catch (error) {
      next(error);
    }
  }
);

// Get single PO
router.get(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE, Role.ACCOUNTS]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
      if (!order) {
        return res.status(404).json({ error: { message: 'Purchase order not found' } });
      }
      return res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Create Purchase Order (Admin, Warehouse)
router.post(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE]),
  validate(purchaseOrderCreateSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { supplierName, poDate, status, items } = req.body;

    try {
      const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitCost, 0);

      const newOrder = await prisma.purchaseOrder.create({
        data: {
          supplierName,
          poDate,
          status,
          totalAmount,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });

      return res.status(201).json(newOrder);
    } catch (error) {
      next(error);
    }
  }
);

// Receive Purchase Order (Admin, Warehouse only)
router.patch(
  '/:id/receive',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;

    try {
      // Find the PO first
      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!po) {
        return res.status(404).json({ error: { message: 'Purchase order not found' } });
      }

      if (po.status === POStatus.RECEIVED) {
        return res.status(400).json({ error: { message: 'Purchase order is already received' } });
      }

      if (po.status === POStatus.CANCELLED) {
        return res.status(400).json({ error: { message: 'Cannot receive a cancelled purchase order' } });
      }

      // Perform transaction: Update PO status, update stock levels, create stock movements
      const updatedPo = await prisma.$transaction(async (tx: any) => {
        // 1. Update PO Status
        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: { status: POStatus.RECEIVED },
        });

        // 2. Loop items to increment stock
        for (const item of po.items) {
          // Increment stock on product
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                increment: item.quantity,
              },
            },
          });

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: 'IN',
              referenceId: po.id,
              referenceType: 'PO',
              notes: `Stock In: Received from PO #${po.id} (Supplier: ${po.supplierName})`,
            },
          });
        }

        return updated;
      });

      return res.status(200).json(updatedPo);
    } catch (error) {
      next(error);
    }
  }
);

// Cancel PO (Admin, Warehouse only)
router.patch(
  '/:id/cancel',
  authenticate,
  requireRole([Role.ADMIN, Role.WAREHOUSE]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const po = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!po) {
        return res.status(404).json({ error: { message: 'Purchase order not found' } });
      }

      if (po.status === POStatus.RECEIVED) {
        return res.status(400).json({ error: { message: 'Cannot cancel a received purchase order' } });
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: POStatus.CANCELLED },
      });

      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

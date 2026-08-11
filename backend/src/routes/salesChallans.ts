import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { validate } from '../middleware/validate';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role, ChallanStatus, PaymentStatus } from '@prisma/client';

const router = Router();

const challanItemSchema = z.object({
  productId: z.number().int().positive('Product ID must be positive'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unitPrice: z.number().positive('Unit price must be positive'),
});

const challanCreateSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID must be positive'),
    challanDate: z.string().transform((val) => new Date(val)),
    status: z.nativeEnum(ChallanStatus).optional().default(ChallanStatus.DRAFT),
    items: z.array(challanItemSchema).min(1, 'At least one item is required'),
  }),
});

const statusUpdateSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ChallanStatus),
  }),
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

// Helper function to auto-generate Challan Number
async function generateChallanNumber(): Promise<string> {
  const count = await prisma.salesChallan.count();
  const year = new Date().getFullYear();
  return `CH-${year}-${String(count + 1).padStart(4, '0')}`;
}

// List Sales Challans (Admin, Sales, Warehouse, Accounts)
router.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS]),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const challans = await prisma.salesChallan.findMany({
        include: {
          customer: {
            select: { id: true, name: true, companyName: true, billingAddress: true, shippingAddress: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          items: {
            include: {
              product: {
                select: { sku: true, name: true, unit: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(challans);
    } catch (error) {
      next(error);
    }
  }
);

// Get single Challan
router.get(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const challan = await prisma.salesChallan.findUnique({
        where: { id },
        include: {
          customer: true,
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });
      if (!challan) {
        return res.status(404).json({ error: { message: 'Sales Challan not found' } });
      }
      return res.status(200).json(challan);
    } catch (error) {
      next(error);
    }
  }
);

// Create Sales Challan (Admin, Sales only)
router.post(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(challanCreateSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { customerId, challanDate, status, items } = req.body;
    const userId = req.user?.id;

    try {
      // 1. Check customer exists
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(400).json({ error: { message: 'Customer does not exist', field: 'customerId' } });
      }

      // 2. Fetch product details to create snapshots & calculate total quantity
      const productIds = items.map((i: any) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Validate all products exist
      for (const item of items) {
        if (!productMap.has(item.productId)) {
          return res.status(400).json({ error: { message: `Product ID ${item.productId} not found` } });
        }
      }

      // Calculate total quantity
      const totalQuantity = items.reduce((sum: number, i: any) => sum + i.quantity, 0);

      // Build item snapshot objects
      const itemSnapshots = items.map((item: any) => {
        const prod = productMap.get(item.productId)!;
        return {
          productId: item.productId,
          productName: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        };
      });

      // 3. Stock check if creating as CONFIRMED directly
      if (status === ChallanStatus.CONFIRMED || status === ChallanStatus.DISPATCHED) {
        for (const item of items) {
          const prod = productMap.get(item.productId)!;
          if (prod.currentStock < item.quantity) {
            return res.status(400).json({
              error: {
                message: `Insufficient stock for product "${prod.name}" (SKU: ${prod.sku}). Available: ${prod.currentStock}, Requested: ${item.quantity}`,
                field: 'stock',
              },
            });
          }
        }
      }

      // Auto-generate unique Challan Number
      const challanNumber = await generateChallanNumber();

      // 4. Perform transaction
      const newChallan = await prisma.$transaction(async (tx: any) => {
        const challan = await tx.salesChallan.create({
          data: {
            challanNumber,
            customerId,
            createdById: userId || null,
            challanDate,
            status,
            totalQuantity,
            items: {
              create: itemSnapshots,
            },
          },
          include: {
            items: true,
            customer: true,
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });

        // If CONFIRMED or DISPATCHED, deduct stock and record movement
        if (status === ChallanStatus.CONFIRMED || status === ChallanStatus.DISPATCHED) {
          for (const item of items) {
            const prod = productMap.get(item.productId)!;

            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: {
                  decrement: item.quantity,
                },
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: -item.quantity,
                type: 'OUT',
                referenceId: challan.id,
                referenceType: 'CHALLAN',
                createdById: userId || null,
                notes: `Stock Out: Confirmed in Challan #${challan.challanNumber} for ${customer.name} (${customer.companyName})`,
              },
            });
          }
        }

        return challan;
      });

      return res.status(201).json(newChallan);
    } catch (error) {
      next(error);
    }
  }
);

// Update Status (Confirm / Cancel / Dispatch / Deliver)
router.patch(
  '/:id/status',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.WAREHOUSE]),
  validate(statusUpdateSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    const { status: targetStatus } = req.body;
    const userId = req.user?.id;

    try {
      const challan = await prisma.salesChallan.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
          customer: true,
        },
      });

      if (!challan) {
        return res.status(404).json({ error: { message: 'Sales Challan not found' } });
      }

      if (challan.status === targetStatus) {
        return res.status(400).json({ error: { message: `Challan is already in ${targetStatus} status.` } });
      }

      // Transition Logic:
      // 1. DRAFT -> CONFIRMED / DISPATCHED: Requires stock deduction
      const isActivating =
        challan.status === ChallanStatus.DRAFT &&
        (targetStatus === ChallanStatus.CONFIRMED || targetStatus === ChallanStatus.DISPATCHED);

      // 2. CONFIRMED / DISPATCHED / DELIVERED -> CANCELLED: Restores stock if previously deducted
      const isCancellingDeducted =
        (challan.status === ChallanStatus.CONFIRMED ||
          challan.status === ChallanStatus.DISPATCHED ||
          challan.status === ChallanStatus.DELIVERED) &&
        targetStatus === ChallanStatus.CANCELLED;

      if (isActivating) {
        // Validate stock
        for (const item of challan.items) {
          if (item.product.currentStock < item.quantity) {
            return res.status(400).json({
              error: {
                message: `Insufficient stock for product "${item.productName || item.product.name}" (SKU: ${item.sku || item.product.sku}). Available: ${item.product.currentStock}, Requested: ${item.quantity}`,
                field: 'stock',
              },
            });
          }
        }
      }

      const updatedChallan = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.salesChallan.update({
          where: { id },
          data: { status: targetStatus },
          include: {
            customer: true,
            createdBy: { select: { id: true, name: true, email: true } },
            items: true,
          },
        });

        if (isActivating) {
          for (const item of challan.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { decrement: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: -item.quantity,
                type: 'OUT',
                referenceId: challan.id,
                referenceType: 'CHALLAN',
                createdById: userId || null,
                notes: `Stock Out: Confirmed Challan #${challan.challanNumber || challan.id} for ${challan.customer.name}`,
              },
            });
          }
        } else if (isCancellingDeducted) {
          for (const item of challan.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: item.quantity,
                type: 'IN',
                referenceId: challan.id,
                referenceType: 'CHALLAN',
                createdById: userId || null,
                notes: `Stock Restored: Cancelled Challan #${challan.challanNumber || challan.id} for ${challan.customer.name}`,
              },
            });
          }
        }

        return updated;
      });

      return res.status(200).json(updatedChallan);
    } catch (error) {
      next(error);
    }
  }
);

// Dispatch Sales Challan (Legacy / convenience route)
router.patch(
  '/:id/dispatch',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.WAREHOUSE]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;

    try {
      const challan = await prisma.salesChallan.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
          customer: true,
        },
      });

      if (!challan) {
        return res.status(404).json({ error: { message: 'Sales Challan not found' } });
      }

      if (challan.status === ChallanStatus.DISPATCHED) {
        return res.status(400).json({ error: { message: 'Challan is already dispatched' } });
      }

      const needsDeduction = challan.status === ChallanStatus.DRAFT;

      if (needsDeduction) {
        for (const item of challan.items) {
          if (item.product.currentStock < item.quantity) {
            return res.status(400).json({
              error: {
                message: `Insufficient stock for product "${item.productName || item.product.name}" (SKU: ${item.sku || item.product.sku}). Available: ${item.product.currentStock}, Requested: ${item.quantity}`,
                field: 'stock',
              },
            });
          }
        }
      }

      const updatedChallan = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.salesChallan.update({
          where: { id },
          data: { status: ChallanStatus.DISPATCHED },
        });

        if (needsDeduction) {
          for (const item of challan.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { decrement: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: -item.quantity,
                type: 'OUT',
                referenceId: challan.id,
                referenceType: 'CHALLAN',
                notes: `Stock Out: Dispatched in Challan #${challan.challanNumber || challan.id} to Customer: ${challan.customer.name}`,
              },
            });
          }
        }

        return updated;
      });

      return res.status(200).json(updatedChallan);
    } catch (error) {
      next(error);
    }
  }
);

// Convert Sales Challan to Invoice (Admin, Sales, Accounts)
router.post(
  '/:id/convert-to-invoice',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES, Role.ACCOUNTS]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;

    try {
      const challan = await prisma.salesChallan.findUnique({
        where: { id },
        include: {
          items: true,
          invoices: true,
        },
      });

      if (!challan) {
        return res.status(404).json({ error: { message: 'Sales Challan not found' } });
      }

      if (challan.status === ChallanStatus.DRAFT) {
        return res.status(400).json({ error: { message: 'Cannot convert draft challan to invoice. Confirm or dispatch it first.' } });
      }

      if (challan.status === ChallanStatus.CANCELLED) {
        return res.status(400).json({ error: { message: 'Cannot convert cancelled challan to invoice.' } });
      }

      if (challan.invoices.length > 0) {
        return res.status(400).json({
          error: { message: `Challan is already converted to Invoice #${challan.invoices[0].invoiceNumber}` },
        });
      }

      const count = await prisma.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const subtotal = challan.items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
      const tax = parseFloat((subtotal * 0.18).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId: challan.customerId,
          challanId: challan.id,
          subtotal,
          tax,
          total,
          paymentStatus: PaymentStatus.UNPAID,
          dueDate,
          items: {
            create: challan.items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return res.status(201).json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

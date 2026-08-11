import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    // 1. Customer Count
    const customerCount = await prisma.customer.count();

    // 2. Low Stock Products calculation (ORM safe)
    const allProducts = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const lowStockList = allProducts.filter((p) => p.currentStock <= p.reorderLevel);
    const lowStockCount = lowStockList.length;
    const lowStockProducts = lowStockList.slice(0, 5);

    // 3. Pending POs
    const pendingPoCount = await prisma.purchaseOrder.count({
      where: {
        status: {
          in: ['DRAFT', 'ORDERED'],
        },
      },
    });

    // 4. Unpaid Invoices
    const unpaidInvoiceCount = await prisma.invoice.count({
      where: {
        paymentStatus: {
          in: ['UNPAID', 'PARTIAL'],
        },
      },
    });

    // 5. Pending Follow-ups
    const pendingFollowupCount = await prisma.followup.count({
      where: {
        status: 'PENDING',
      },
    });

    // 6. Recent Sales Challans
    const recentChallans = await prisma.salesChallan.findMany({
      take: 5,
      include: {
        customer: { select: { name: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 7. Recent Invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      include: {
        customer: { select: { name: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      counts: {
        customers: customerCount,
        lowStock: lowStockCount,
        pendingPOs: pendingPoCount,
        unpaidInvoices: unpaidInvoiceCount,
        pendingFollowups: pendingFollowupCount,
      },
      recentChallans,
      recentInvoices,
      lowStockProducts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

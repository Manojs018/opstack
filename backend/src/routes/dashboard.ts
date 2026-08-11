import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    // 1. Customer Count
    const customerCount = await prisma.customer.count();

    // 2. Low Stock Count
    // Compare currentStock <= reorderLevel. Using raw sql or standard sql is necessary.
    const lowStockResult = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count FROM "Product" WHERE "currentStock" <= "reorderLevel"
    `;
    const lowStockCount = lowStockResult[0]?.count || 0;

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
        customer: { select: { name: true, companyName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 7. Recent Invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      include: {
        customer: { select: { name: true, companyName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 8. Low Stock Products list (first 5)
    const lowStockProducts = await prisma.$queryRaw<any[]>`
      SELECT * FROM "Product" WHERE "currentStock" <= "reorderLevel" ORDER BY "currentStock" ASC LIMIT 5
    `;

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

import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { validate } from '../middleware/validate';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role, FollowupType, FollowupStatus } from '@prisma/client';

const router = Router();

const querySchema = z.object({
  query: z.object({
    status: z.nativeEnum(FollowupStatus).optional(),
    assignedTo: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
    customerId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  }),
});

const followupBodySchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID must be positive'),
    type: z.nativeEnum(FollowupType),
    dueDate: z.string().transform((val) => new Date(val)),
    status: z.nativeEnum(FollowupStatus).optional().default(FollowupStatus.PENDING),
    notes: z.string().optional().nullable(),
    assignedToId: z.number().int().positive('Assigned user ID must be positive'),
  }),
});

const followupUpdateSchema = z.object({
  body: z.object({
    type: z.nativeEnum(FollowupType).optional(),
    dueDate: z.string().transform((val) => new Date(val)).optional(),
    status: z.nativeEnum(FollowupStatus).optional(),
    notes: z.string().optional().nullable(),
    assignedToId: z.number().int().positive().optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

// List follow-ups (Admin and Sales roles)
router.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(querySchema),
  async (req: AuthRequest, res: Response, next) => {
    const { status, assignedTo, customerId } = req.query as any;

    try {
      const where: any = {};
      if (status) {
        where.status = status;
      }
      if (assignedTo) {
        where.assignedToId = assignedTo;
      }
      if (customerId) {
        where.customerId = customerId;
      }

      const data = await prisma.followup.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, companyName: true }
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { dueDate: 'asc' },
      });

      return res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }
);

// Create follow-up (Admin and Sales)
router.post(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(followupBodySchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const newFollowup = await prisma.followup.create({
        data: req.body,
        include: {
          customer: true,
          assignedTo: true,
        },
      });
      return res.status(201).json(newFollowup);
    } catch (error) {
      next(error);
    }
  }
);

// Update follow-up details (Admin and Sales)
router.patch(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(idParamSchema.merge(followupUpdateSchema)),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const updated = await prisma.followup.update({
        where: { id },
        data: req.body,
        include: {
          customer: true,
          assignedTo: true,
        },
      });
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Quick mark done (Admin and Sales)
router.patch(
  '/:id/mark-done',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      const updated = await prisma.followup.update({
        where: { id },
        data: { status: FollowupStatus.DONE },
      });
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete follow-up (Admin and Sales)
router.delete(
  '/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SALES]),
  validate(idParamSchema),
  async (req: AuthRequest, res: Response, next) => {
    const { id } = req.params as any;
    try {
      await prisma.followup.delete({
        where: { id },
      });
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

export default router;

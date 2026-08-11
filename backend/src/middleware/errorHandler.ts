import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface AppError extends Error {
  status?: number;
  field?: string;
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[Error Handler]:', err);

  let status = 500;
  let message = 'An unexpected error occurred';
  let field: string | undefined = undefined;

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    status = 400;
    const firstIssue = err.issues[0];
    message = firstIssue.message;
    field = firstIssue.path.join('.');
    return res.status(status).json({
      error: {
        message,
        field,
      },
    });
  }

  // Handle Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      message = 'A record with this value already exists';
      const targets = err.meta?.target as string[] | undefined;
      field = targets ? targets.join('.') : undefined;
    } else if (err.code === 'P2025') {
      status = 404;
      message = err.meta?.cause as string || 'Record not found';
    }
  }

  // Handle custom application errors
  if (err.status) {
    status = err.status;
  }
  if (err.message && status !== 500) {
    message = err.message;
  }
  if (err.field) {
    field = err.field;
  }

  return res.status(status).json({
    error: {
      message,
      ...(field ? { field } : {}),
    },
  });
};

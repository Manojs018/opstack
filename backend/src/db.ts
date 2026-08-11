import { PrismaClient } from '@prisma/client';

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') && !process.env.DATABASE_URL.includes('sslmode=')) {
  const separator = process.env.DATABASE_URL.includes('?') ? '&' : '?';
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}sslmode=require`;
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;

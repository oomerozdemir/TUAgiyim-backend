import { PrismaClient } from '@prisma/client';

let prisma;
if (!globalThis.prisma) {
  globalThis.prisma = new PrismaClient({ log: ['error', 'warn'] });
}
prisma = globalThis.prisma;

export default prisma;

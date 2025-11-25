import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

export async function softAuth(req, _res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return next();
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, email: true }});
    if (user) req.user = user;
  } catch (_) {
  }
  next();
}

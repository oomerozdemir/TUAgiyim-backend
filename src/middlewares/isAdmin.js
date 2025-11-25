export function isAdmin(req, res, next) {
  if (req.user && req.user.role?.toLowerCase() === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Yetkisiz (admin gerekli)' });
}
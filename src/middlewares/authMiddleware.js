import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

export const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      // <-- frontend’in anlayacağı sinyal
      return res.status(401).json({ message: "Access token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Unauthorized" });
  }
};
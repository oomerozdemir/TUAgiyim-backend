import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import prisma from "./prisma.js";
import productRoutes from "./routes/productRoutes.js"
import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js"
import stockRoutes from './routes/stockRoutes.js';
import categoryRoutes from "./routes/categoryRoutes.js"
import favoriteRoutes from "./routes/favoriteRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import accountRoutes from "./routes/accountRoutes.js"
import reviewRoutes from "./routes/reviewRoutes.js"
import contactRoutes from "./routes/contactRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"

import { getSitemap } from "./controllers/sitemapController.js";


dotenv.config();
const app = express();

const allowedOrigins = [
  "http://localhost:5173", 
  "http://localhost:3000",
  process.env.FRONTEND_URL 
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(cookieParser());        
 app.use(express.json());

 app.use(express.urlencoded({ extended: true })); 

// Health
app.get('/api/health', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.get("/sitemap.xml", getSitemap);

// Routes
app.use('/api/products', productRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/categories', categoryRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/payment", paymentRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Backend is running successfully 🚀",
    docs: "/api/health"
  });
});


// 404 & Error
app.use(notFound);
app.use(errorHandler);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server http://localhost:${PORT} üzerinde`));

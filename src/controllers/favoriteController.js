import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";

export const listFavorites = asyncHandler(async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { userId: req.user.id },
    include: { product: { include: { images: true } } },
  });

  res.json(
    favorites.map((f) => ({
      id: f.id,
      product: f.product,
    }))
  );
});

// POST /api/favorites/:productId  
export const toggleFavorite = asyncHandler(async (req, res) => {
   if (!req.user?.id) {
    return res.status(401).json({ message: "Giriş gerekli" });
  }
  const userId = req.user.id;
  const productId = req.params.productId;

  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });

   if (!productId || productId === "undefined") {
    return res.status(400).json({ message: "productId eksik" });
  }

  if (existing) {
    await prisma.favorite.delete({
      where: { userId_productId: { userId, productId } },
    });
    return res.json({ ok: true, favorited: false });
  } else {
     await prisma.favorite.create({ data: { userId, productId } });
    return res.status(201).json({ ok: true, favorited: true });
  }
});

// GET /api/favorites  
export const listMyFavorites = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const favs = await prisma.favorite.findMany({
    where: { userId },
    include: {
      product: { include: { images: true, categories: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    items: favs.map((f) => ({
      id: f.product.id,
      name: f.product.name,
      price: f.product.price,          
      images: f.product.images,
      categories: f.product.categories,
      favoritedAt: f.createdAt,
    })),
  });
});

// GET /api/favorites/check/:productId 
export const isFavorited = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId; 

   if (!productId || productId === "undefined") {
    return res.json({ favorited: false });
  }

  const fav = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });
  res.json({ favorited: Boolean(fav) });
});



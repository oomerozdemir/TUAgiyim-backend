import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";

/**
 * Kullanıcı bu ürünü sipariş etmiş mi kontrolü
 */
async function userCanReviewProduct(userId, productId) {
  if (!userId) return false;

  const order = await prisma.order.findFirst({
    where: {
      userId,
      // ❌ Buradan PENDING'i çıkarıyoruz
      status: { in: ["PAID", "SHIPPED"] }, // sadece gerçekten ödenmiş / kargolanmış siparişler
      items: {
        some: { productId },
      },
    },
    select: { id: true },
  });

  return !!order;
}

/**
 * POST /api/reviews
 * body: { productId, rating, comment? }
 * — sadece ürünü almış kullanıcıya izin verir
 */
export const createOrUpdateReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, rating, comment } = req.body || {};

  if (!productId || !rating) {
    return res.status(400).json({ message: "Ürün ve puan zorunlu." });
  }

  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ message: "Puan 1 ile 5 arasında olmalı." });
  }

  const canReview = await userCanReviewProduct(userId, productId);
  if (!canReview) {
    return res
      .status(403)
      .json({ message: "Bu ürünü değerlendirmek için önce satın almalısınız." });
  }

  const review = await prisma.review.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    update: {
      rating: r,
      comment: comment || null,
    },
    create: {
      userId,
      productId,
      rating: r,
      comment: comment || null,
    },
  });

  res.status(201).json(review);
});

/**
 * GET /api/reviews/product/:productId
 * — herkese açık: ortalama puan, adet, yorum listesi
 *   + login kullanıcı için kendi yorumunu döner
 */
export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user?.id || null; // opsiyonel (protectOptional varsa)

  const [summary, list, myReview] = await Promise.all([
    prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
      },
      take: 20, // ilk 20 yorum
    }),
    userId
      ? prisma.review.findUnique({
          where: {
            userId_productId: { userId, productId },
          },
        })
      : null,
  ]);

  const canReview = userId
    ? await userCanReviewProduct(userId, productId)
    : false;

  res.json({
    averageRating: summary._avg.rating || 0,
    ratingCount: summary._count._all || 0,
    reviews: list,
    myReview,
    canReview,
  });
});

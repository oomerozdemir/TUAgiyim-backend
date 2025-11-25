// src/controllers/cartController.js
import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";

/** Pending order (Sepet) getir/yarat */
async function getOrCreatePendingOrder(tx, userId) {
  let order = await tx.order.findFirst({
    where: { userId, status: "PENDING" },
  });

  if (!order) {
    order = await tx.order.create({
      data: {
        userId,
        status: "PENDING",
        total: 0,
      },
    });
  }
  return order;
}

/** Varyant stok bilgisini getir */
async function getVariantStock(tx, { productId, sizeId, colorId }) {
  if (sizeId) {
    const sz = await tx.productSize.findUnique({ where: { id: sizeId } });
    return Number(sz?.stock || 0);
  }
  if (colorId) {
    const col = await tx.productColor.findUnique({ where: { id: colorId } });
    return Number(col?.stock || 0);
  }
  const p = await tx.product.findUnique({ where: { id: productId } });
  return Number(p?.stock || 0);
}

/** Order.total’ı yeniden hesapla */
async function recomputeOrderTotal(tx, orderId) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { price: true, quantity: true },
  });
  const total = items.reduce(
    (a, it) => a + Number(it.price) * Number(it.quantity),
    0
  );
  await tx.order.update({ where: { id: orderId }, data: { total } });
  return total;
}

/** GET /api/cart */
export const getCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const order = await prisma.order.findFirst({
    where: { userId, status: "PENDING" },
    include: {
      items: {
        orderBy: { id: "asc" }, // Eklenme sırasına göre
        include: {
          product: {
            select: { id: true, name: true, price: true, images: true },
          },
        },
      },
    },
  });
  res.json(order || { id: null, items: [], total: 0 });
});

/** POST /api/cart/items */
export const addCartItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity = 1, sizeId = null, colorId = null, sizeLabel = null, colorLabel = null } = req.body;

  if (!productId || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
    return res.status(400).json({ message: "productId ve pozitif quantity gereklidir." });
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await getOrCreatePendingOrder(tx, userId);

    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { sizes: true, colors: true, images: true },
    });
    if (!product) return { status: 404, body: { message: "Ürün bulunamadı." } };

    // Stok kontrolü
    const stock = await getVariantStock(tx, { productId, sizeId, colorId });

    // Sepette mevcut miktar
    const existing = await tx.orderItem.findFirst({
      where: { orderId: order.id, productId, sizeId, colorId },
    });
    const newQty = Number(quantity) + Number(existing?.quantity || 0);

    if (newQty > stock) {
      return {
        status: 409,
        body: { message: `Stok yetersiz. Mevcut stok: ${stock}` },
      };
    }

    // Ekle veya güncelle
    if (existing) {
      await tx.orderItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else {
      // Front-end'den gelen label'ları kullan veya DB'den bul
      let finalSizeLabel = sizeLabel;
      let finalColorLabel = colorLabel;

      if (!finalSizeLabel && sizeId) finalSizeLabel = product.sizes.find((s) => s.id === sizeId)?.label;
      if (!finalColorLabel && colorId) finalColorLabel = product.colors.find((c) => c.id === colorId)?.label;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          quantity: Number(quantity),
          price: product.price,
          sizeId,
          colorId,
          sizeLabel: finalSizeLabel,
          colorLabel: finalColorLabel,
        },
      });
    }

    const total = await recomputeOrderTotal(tx, order.id);

    const full = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          orderBy: { id: "asc" },
          include: {
            product: { select: { id: true, name: true, price: true, images: true } },
          },
        },
      },
    });

    return { status: 201, body: { ...full, total } };
  });

  return res.status(result.status).json(result.body);
});

/** PATCH /api/cart/items/:itemId */
export const updateCartItemQty = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.itemId;
  const quantity = Number(req.body?.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "quantity > 0 olmalı." });
  }

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, order: { userId, status: "PENDING" } },
    });
    if (!item) return { status: 404, body: { message: "Sepet öğesi bulunamadı." } };

    const stock = await getVariantStock(tx, {
      productId: item.productId,
      sizeId: item.sizeId,
      colorId: item.colorId,
    });
    if (quantity > stock) {
      return { status: 409, body: { message: `Stok yetersiz. Mevcut stok: ${stock}` } };
    }

    await tx.orderItem.update({ where: { id: item.id }, data: { quantity } });
    const total = await recomputeOrderTotal(tx, item.orderId);

    const full = await tx.order.findUnique({
      where: { id: item.orderId },
      include: { items: { orderBy: { id: "asc" }, include: { product: { select: { id: true, name: true, price: true, images: true } } } } },
    });
    return { status: 200, body: { ...full, total } };
  });

  return res.status(result.status).json(result.body);
});

/** DELETE /api/cart/items/:itemId */
export const removeCartItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.itemId;

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, order: { userId, status: "PENDING" } },
    });
    if (!item) return { status: 404, body: { message: "Sepet öğesi bulunamadı." } };

    await tx.orderItem.delete({ where: { id: item.id } });
    const total = await recomputeOrderTotal(tx, item.orderId);

    const full = await tx.order.findUnique({
      where: { id: item.orderId },
      include: { items: { orderBy: { id: "asc" }, include: { product: { select: { id: true, name: true, price: true, images: true } } } } },
    });
    return { status: 200, body: { ...full, total } };
  });

  return res.status(result.status).json(result.body);
});

/** DELETE /api/cart */
export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const order = await prisma.order.findFirst({
    where: { userId, status: "PENDING" },
  });
  if (!order) return res.json({ ok: true });

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.update({ where: { id: order.id }, data: { total: 0 } });

  res.json({ ok: true });
});
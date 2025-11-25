import asyncHandler from 'express-async-handler';
import prisma from '../prisma.js';



async function recomputeAndSetTotalStock(tx, productId) {
  // beden toplamı
  const sizeAgg  = await tx.productSize.aggregate({
    where: { productId },
    _sum: { stock: true }
  });
  const sizeSum = Number(sizeAgg._sum.stock || 0);
  if (sizeSum > 0) {
    await tx.product.update({ where: { id: productId }, data: { stock: sizeSum } });
    return sizeSum;
  }
  // renk toplamı
  const colorAgg = await tx.productColor.aggregate({
    where: { productId },
    _sum: { stock: true }
  });
  const colorSum = Number(colorAgg._sum.stock || 0);
  await tx.product.update({ where: { id: productId }, data: { stock: colorSum } });
  return colorSum;
}

// POST /api/stock/:productId/adjust  body: { delta: number, note?: string }
export const adjustStock = asyncHandler(async (req, res) => {
  const productId = req.params.productId;
  const delta = Number(req.body?.delta);
  const note = req.body?.note || null;

  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ message: 'delta pozitif veya negatif sayı olmalı (0 olamaz).' });
  }

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.stockMovement.create({
      data: { productId, delta, note }
    });
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } }
    });
    return created;
  });

  res.status(201).json(movement);
});

// GET /api/stock/:productId/history
export const stockHistory = asyncHandler(async (req, res) => {
  const productId = req.params.productId;

  const items = await prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items);
});


export const adjustSizeStock = asyncHandler(async (req, res) => {
  const { productId, sizeId } = req.params;
  const delta = Number(req.body?.delta);
  const note = req.body?.note || null;

  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ message: 'delta pozitif/negatif bir sayı olmalı (0 olamaz).' });
  }

  const movement = await prisma.$transaction(async (tx) => {
    // 1) hareketi kaydet (bedene bağla)
    const created = await tx.stockMovement.create({
      data: { productId, sizeId, delta, note }
    });

    // 2) beden stokunu arttır/azalt
    await tx.productSize.update({
      where: { id: sizeId },
      data: { stock: { increment: delta } }
    });

    // 3) ürün toplam stokunu yeniden hesapla:
    //    - beden toplamı > 0 ise beden toplamı
    //    - değilse renk toplamı
    const sizeAgg = await tx.productSize.aggregate({
      where: { productId },
      _sum: { stock: true }
    });
    const sizeSum = Number(sizeAgg._sum.stock || 0);

    let total = sizeSum;
    if (sizeSum <= 0) {
      const colorAgg = await tx.productColor.aggregate({
        where: { productId },
        _sum: { stock: true }
      });
      total = Number(colorAgg._sum.stock || 0);
    }

    await tx.product.update({
      where: { id: productId },
      data: { stock: total }
    });

    return created;
  });

  res.status(201).json(movement);
});


export const sizeStockHistory = asyncHandler(async (req, res) => {
  const { productId, sizeId } = req.params;
  const items = await prisma.stockMovement.findMany({
    where: { productId, sizeId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items);
});



// POST /api/stock/:productId/colors/:colorId/adjust   body: { delta:number, note?:string }
export const adjustColorStock = asyncHandler(async (req, res) => {
  const { productId, colorId } = req.params;
  const delta = Number(req.body?.delta);
  const note  = req.body?.note || null;

  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ message: 'delta pozitif/negatif olmalı (0 olamaz).' });
  }

  const movement = await prisma.$transaction(async (tx) => {
    // 1) hareket
    const created = await tx.stockMovement.create({
            data: { productId, colorId, delta, note }
    });
    // 2) renk stok
    await tx.productColor.update({
      where: { id: colorId },
      data: { stock: { increment: delta } }
    });
    // 3) toplam stoğu yeniden hesapla (beden varsa o, yoksa renk)
    await recomputeAndSetTotalStock(tx, productId);
    return created;
  });

  res.status(201).json(movement);
});

// GET /api/stock/:productId/colors/:colorId/history
export const colorStockHistory = asyncHandler(async (req, res) => {
  const { productId, colorId } = req.params;
  const items = await prisma.stockMovement.findMany({
    where: { productId, colorId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items);
});
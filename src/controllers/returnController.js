import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";

/**
 * POST /api/returns
 * İade talebi oluştur
 * Body: { orderId, items: [{ orderItemId, quantity }], reason }
 */
export const createReturnRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId, items, reason } = req.body;

  if (!orderId || !items || !items.length || !reason) {
    return res.status(400).json({ message: "Eksik bilgi." });
  }

  // 1. Sipariş kontrolü
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  if (!order) return res.status(404).json({ message: "Sipariş bulunamadı." });
  if (order.userId !== userId) return res.status(403).json({ message: "Yetkisiz işlem." });
  if (order.status !== "DELIVERED") {
    return res.status(400).json({ message: "Sadece teslim edilmiş siparişler iade edilebilir." });
  }

  // 2. İade süresi kontrolü (30 Gün)
  const deliveryDate = new Date(order.updatedAt); // DELIVERED olduğu tarih
  const now = new Date();
  const diffTime = Math.abs(now - deliveryDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

  if (diffDays > 30) {
    return res.status(400).json({ message: "İade süresi (30 gün) dolmuştur." });
  }

  // 3. Talebi oluştur
  const returnRequest = await prisma.returnRequest.create({
    data: {
      userId,
      orderId,
      reason,
      status: "PENDING",
      items: {
        create: items.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: Number(item.quantity)
        }))
      }
    }
  });

  res.status(201).json(returnRequest);
});

/**
 * GET /api/returns/my
 * Kullanıcının iade talepleri
 */
export const listMyReturns = asyncHandler(async (req, res) => {
  const returns = await prisma.returnRequest.findMany({
    where: { userId: req.user.id },
    include: {
      items: {
        include: {
          orderItem: {
            include: { product: { select: { name: true, images: true } } }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(returns);
});

/**
 * GET /api/returns (ADMIN)
 * Tüm iade talepleri
 */
export const listAllReturns = asyncHandler(async (req, res) => {
  const returns = await prisma.returnRequest.findMany({
    include: {
      user: { select: { name: true, email: true } },
      items: {
        include: {
          orderItem: {
            include: { product: { select: { name: true } } }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(returns);
});

/**
 * PATCH /api/returns/:id/status (ADMIN)
 * İade durumu güncelleme
 */
export const updateReturnStatus = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const { id } = req.params;

  // Transaction kullanarak veri bütünlüğünü koruyalım
  const updated = await prisma.$transaction(async (tx) => {
    
    // 1. Mevcut talebi kontrol et
    const currentRequest = await tx.returnRequest.findUnique({ where: { id } });
    if (!currentRequest) throw new Error("İade talebi bulunamadı.");

    // Eğer zaten REFUNDED ise ve tekrar REFUNDED yapılıyorsa stokları tekrar artırma
    if (currentRequest.status === "REFUNDED" && status === "REFUNDED") {
        return currentRequest;
    }

    // 2. İade durumunu güncelle
    const result = await tx.returnRequest.update({
      where: { id },
      data: {
        status,
        ...(adminNote && { adminNote })
      }
    });

    // 3. Eğer durum 'REFUNDED' (İade Tamamlandı) olduysa stokları geri yükle
    if (status === "REFUNDED") {
       // İade kalemlerini ve bağlı olduğu sipariş kalemlerini (varyant bilgisi için) çek
       const requestWithItems = await tx.returnRequest.findUnique({
           where: { id },
           include: { 
             items: { 
               include: { 
                 orderItem: true 
               } 
             } 
           }
       });

       if (requestWithItems) {
         for (const ri of requestWithItems.items) {
            const { productId, sizeId, colorId } = ri.orderItem;
            const qty = ri.quantity; // İade edilen adet

            // A) Varyant Stoklarını Güncelle (Varsa)
            if (sizeId) {
              await tx.productSize.update({
                where: { id: sizeId },
                data: { stock: { increment: qty } }
              });
            } else if (colorId) {
              // Beden yoksa ama renk varsa
              await tx.productColor.update({
                where: { id: colorId },
                data: { stock: { increment: qty } }
              });
            }

            // B) Ana Ürün Toplam Stokunu Güncelle (Her durumda artırıyoruz)
            await tx.product.update({
              where: { id: productId },
              data: { stock: { increment: qty } }
            });

            // C) Stok Hareketini Kaydet (Loglama)
            await tx.stockMovement.create({
              data: {
                productId,
                delta: qty, // Pozitif değer (Stok girişi)
                note: `İade Stok Girişi (Talep #${id.slice(0, 8)})`,
                sizeId: sizeId || null,
                colorId: colorId || null
              }
            });
         }
       }
    }

    return result;
  });

  res.json(updated);
});
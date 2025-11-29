import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";
import { sendMail } from "../utils/mailService.js";
import { buildOrderConfirmationEmail, buildOrderDeliveredEmail, buildOrderShippedEmail } from "../utils/emailTemplates.js";

/**
 * POST /api/orders
 */
export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const {
    items,
    shipping,
    shippingAddressId,
  } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "Sepet boş, sipariş oluşturulamadı." });
  }

  // --- RETRY MECHANISM (Race Condition Çözümü) ---
  let retries = 5;
  
  while (retries > 0) {
    try {
      const result = await prisma.$transaction(async (tx) => {

        const lastOrder = await tx.order.findFirst({
          where: { orderNumber: { not: null } },
          orderBy: { orderNumber: "desc" },
          select: { orderNumber: true },
        });

        const START_NUMBER = 4758;
        const nextOrderNumber = lastOrder && lastOrder.orderNumber >= START_NUMBER
          ? lastOrder.orderNumber + 1 
          : START_NUMBER;

        const productIds = [...new Set(items.map((i) => i.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          include: { sizes: true, colors: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));

        let total = 0;

        for (const item of items) {
          const product = productMap.get(item.productId);
          if (!product) throw { status: 400, message: "Bazı ürünler bulunamadı." };

          const qty = Number(item.quantity || 1);
          if (qty <= 0) throw { status: 400, message: "Adet bilgisi geçersiz." };

          let currentStock = Number(product.stock || 0);

          if (item.sizeId) {
            const sz = product.sizes.find((s) => s.id === item.sizeId);
            if (!sz) throw { status: 400, message: `${product.name} için beden bulunamadı.` };
            currentStock = Number(sz.stock);
          } 
          else if (item.colorId) {
            const col = product.colors.find((c) => c.id === item.colorId);
            if (!col) throw { status: 400, message: `${product.name} için renk bulunamadı.` };
            currentStock = Number(col.stock);
          }

          if (qty > currentStock) {
            throw {
              status: 409,
              message: `${product.name} için stok yetersiz. Mevcut stok: ${currentStock}`,
            };
          }

          total += Number(product.price) * qty;
        }

        let shippingSnapshot;

        if (shippingAddressId) {
          const addr = await tx.address.findFirst({
            where: { id: shippingAddressId, userId },
          });
          if (!addr) throw { status: 400, message: "Seçilen adres bulunamadı." };

          shippingSnapshot = {
            shippingAddressId: addr.id,
            shippingName: addr.fullName,
            shippingPhone: addr.phone,
            shippingCity: addr.city,
            shippingDistrict: addr.district,
            shippingNeighborhood: addr.neighborhood,
            shippingAddressLine: addr.addressLine,
            shippingPostalCode: addr.postalCode,
            customerNote: shipping?.note || null,
          };
        } 
        else if (shipping) {
          shippingSnapshot = {
            shippingAddressId: null,
            shippingName: shipping.fullName,
            shippingPhone: shipping.phone,
            shippingCity: shipping.city,
            shippingDistrict: shipping.district,
            shippingNeighborhood: shipping.neighborhood || null,
            shippingAddressLine: shipping.addressLine,
            shippingPostalCode: shipping.postalCode || null,
            customerNote: shipping.note || null,
          };
        } 
        else {
          throw { status: 400, message: "Teslimat adresi zorunludur." };
        }

        const order = await tx.order.create({
          data: {
            orderNumber: nextOrderNumber,   
            userId,
            status: "PAID",                 
            total,
            ...shippingSnapshot,
            items: {
              create: items.map((item) => {
                const product = productMap.get(item.productId);
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  price: product.price,
                  sizeId: item.sizeId ?? null,
                  colorId: item.colorId ?? null,
                  sizeLabel: item.sizeLabel ?? null,
                  colorLabel: item.colorLabel ?? null,
                };
              }),
            },
          },
        });

        for (const item of items) {
          const product = productMap.get(item.productId);
          const qty = Number(item.quantity);

          const selectedSize = item.sizeId ? product.sizes.find((s) => s.id === item.sizeId) : null;
          const selectedColor = item.colorId ? product.colors.find((c) => c.id === item.colorId) : null;

          if (selectedSize) {
            await tx.productSize.update({ where: { id: selectedSize.id }, data: { stock: { decrement: qty } } });
          } 
          else if (selectedColor) {
            await tx.productColor.update({ where: { id: selectedColor.id }, data: { stock: { decrement: qty } } });
          } 
          else {
            await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: qty } } });
          }

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              delta: -qty,
              note: `Order ${order.orderNumber} satış`,
              sizeId: selectedSize?.id || null,
              colorId: selectedColor?.id || null,
            },
          });
        }

        const fullOrder = await tx.order.findUnique({
          where: { id: order.id },
          include: {
            user: { select: { id: true, name: true, email: true } },
            items: {
              include: {
                product: {
                  select: { id: true, name: true, images: true, price: true },
                },
              },
            },
          },
        });

        return fullOrder;
      });

      if (result?.user?.email) {
        try {
          const { subject, html } = buildOrderConfirmationEmail(result);
          await sendMail({ to: result.user.email, subject, html });
        } catch (err) {
          console.error("Sipariş onay maili gönderilemedi:", err);
        }
      }

      return res.status(201).json(result);

    } catch (err) {
      if (err.code === 'P2002' && err.meta?.target?.includes('orderNumber')) {
        retries--;
        if (retries === 0) return res.status(500).json({ message: "Sipariş numarası üretilemedi." });
        continue;
      }
      if (err.status && err.message) return res.status(err.status).json({ message: err.message });
      console.error(err);
      return res.status(500).json({ message: "Sunucu hatası." });
    }
  }
});

// ✅ Kullanıcının Siparişlerini Listele
export const listMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const orders = await prisma.order.findMany({
    where: { 
        userId,
        status: { 
            notIn: ["PENDING", "AWAITING_PAYMENT"] 
        }
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, price: true, images: true },
          },
        },
      },
    },
  });

  res.json(orders);
});

// ✅ TÜM siparişleri listele (admin)
export const listAllOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const where = {};
  if (status) {
    where.status = status;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, images: true, price: true },
          },
        },
      },
    },
  });

  res.json(orders);
});

// ✅ Sipariş durumunu ve Kargo bilgilerini güncelle (admin)
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, cargoTrackingNumber, cargoCompany } = req.body;

  const allowed = ["PENDING", "AWAITING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "CANCELED"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Geçersiz sipariş durumu." });
  }

  const data = { status };
  if (cargoTrackingNumber !== undefined) data.cargoTrackingNumber = cargoTrackingNumber;
  if (cargoCompany !== undefined) data.cargoCompany = cargoCompany;

  // 1. Siparişi Güncelle 
  const order = await prisma.order.update({
    where: { id },
    data,
    include: { user: { select: { email: true, name: true } } }
  });

  // 2. Duruma Göre Mail Gönder 
  if (order.user?.email) {
    
    // A) KARGOLANDI MAİLİ
    if (status === "SHIPPED") {
      try {
        const { subject, html } = buildOrderShippedEmail(order);
        await sendMail({ to: order.user.email, subject, html });
      } catch (e) {
        console.error("Kargo maili hatası:", e);
      }
    }

    // B) TESLİM EDİLDİ MAİLİ
    if (status === "DELIVERED") {
      try {
        const { subject, html } = buildOrderDeliveredEmail(order);
        await sendMail({ to: order.user.email, subject, html });
      } catch (e) {
        console.error("Teslimat maili hatası:", e);
      }
    }

  }

  res.json(order);
});

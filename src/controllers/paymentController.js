import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";
import { getPaytrToken, verifyPaytrHash } from "../lib/paytr.js";
import { sendMail } from "../utils/mailService.js";
import { buildOrderConfirmationEmail } from "../utils/emailTemplates.js";

/**
 * 1. Ödeme Başlatma
 */
export const startPayment = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  
  const { items, shipping, shippingAddressId } = req.body;

  // 1. Ürün ve Fiyat Kontrolü
  if (!items?.length) return res.status(400).json({ message: "Sepet boş." });

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let total = 0;
  const basket = []; 

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) throw { status: 400, message: "Ürün bulunamadı." };
    
    const price = Number(product.price);
    total += price * item.quantity;
    
    basket.push([product.name, price.toString(), item.quantity]);
  }

  // 2. Sipariş Numarası Üret
  const lastOrder = await prisma.order.findFirst({
      where: { orderNumber: { not: null } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
  });
  const START_NUMBER = 4758;
  const orderNumber = lastOrder && lastOrder.orderNumber >= START_NUMBER ? lastOrder.orderNumber + 1 : START_NUMBER;
  
  const merchant_oid = `SP${orderNumber}R${Date.now().toString().slice(-4)}`; 

  // 3. Adres Bilgisi Hazırla
  let addressInfo = {};
  if (shippingAddressId) {
    const addr = await prisma.address.findUnique({ where: { id: shippingAddressId } });
    if (!addr) throw { status: 400, message: "Adres bulunamadı." };
    
    addressInfo = {
        name: addr.fullName,
        address: `${addr.addressLine} ${addr.district}/${addr.city}`,
        phone: addr.phone,
        email: req.user.email
    };
  } else {
    addressInfo = {
        name: shipping.fullName,
        address: `${shipping.addressLine} ${shipping.district}/${shipping.city}`,
        phone: shipping.phone,
        email: req.user.email
    };
  }

  // 4. Siparişi Oluştur
  await prisma.order.create({
    data: {
      orderNumber: orderNumber,
      userId,
      status: "PENDING", 
      total,
      shippingName: addressInfo.name,
      shippingAddressLine: addressInfo.address,
      shippingPhone: addressInfo.phone,
      shippingCity: shipping?.city,
      shippingDistrict: shipping?.district,
      items: {
        create: items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            price: productMap.get(i.productId).price,
            sizeId: i.sizeId,
            colorId: i.colorId,
        }))
      }
    }
  });

  // 5. PayTR Token Al
  const user_basket = Buffer.from(JSON.stringify(basket)).toString("base64");
  const paytrResult = await getPaytrToken({
    user_ip: userIp,
    merchant_oid: merchant_oid,
    email: addressInfo.email,
    payment_amount: total,
    user_name: addressInfo.name,
    user_address: addressInfo.address,
    user_phone: addressInfo.phone,
    user_basket,
    test_mode: process.env.PAYTR_TEST_MODE || 1 
  });

  if (paytrResult.status === "success") {
    return res.status(200).json({ 
        token: paytrResult.token, 
        merchant_oid 
    });
  } else {
    console.error("PayTR Error:", paytrResult.reason);
    return res.status(500).json({ message: "Ödeme servisine bağlanılamadı. Hata: " + paytrResult.reason });
  }
});

/**
 * 2. PayTR Callback (PayTR Sunucusu Buraya İstek Atar)
 */
export const paymentCallback = asyncHandler(async (req, res) => {
  const { merchant_oid, status, total_amount, hash } = req.body;

  // 1. Hash Doğrulama
  if (!verifyPaytrHash(req.body)) {
    return res.send("PAYTR notification failed: bad hash");
  }

  const orderNumberStr = merchant_oid.split('R')[0].replace('SP', '');
  const orderNumber = parseInt(orderNumberStr);

  const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumber },
      include: { items: true, user: true }
  });

  if (!order) return res.send("Order not found");

  // 2. Ödeme Başarılı mı?
  if (status === "success") {
    
    if (order.status === "PAID") return res.send("OK");

    await prisma.$transaction(async (tx) => {
        // Durumu güncelle
        await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID" }
        });

        // Stokları düş
        for (const item of order.items) {
            if (item.sizeId) {
                await tx.productSize.update({ where: { id: item.sizeId }, data: { stock: { decrement: item.quantity } } });
            } else if (item.colorId) {
                await tx.productColor.update({ where: { id: item.colorId }, data: { stock: { decrement: item.quantity } } });
            } else {
                await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
            }
            
            await tx.stockMovement.create({
                data: {
                    productId: item.productId,
                    delta: -item.quantity,
                    note: `Order #${order.orderNumber} (PayTR)`,
                    sizeId: item.sizeId,
                    colorId: item.colorId
                }
            });
        }
    });

    // Mail Gönder
    try {
        const { subject, html } = buildOrderConfirmationEmail(order);
        await sendMail({ to: order.user.email, subject, html });
    } catch (e) { console.error("Mail hatası", e); }

    return res.send("OK");

  } else {
    // Ödeme başarısız -> CANCELED
    await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELED" }
    });
    return res.send("OK");
  }
});

const tl = (n) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

/**
 * Sipariş onay maili (Modern & Şık Tasarım)
 * @param {Order & { user: {email,name}, items: any[] }} order
 * @returns {{ subject: string, html: string }}
 */
export function buildOrderConfirmationEmail(order) {
  const orderNumber = order.orderNumber || order.id?.slice(0, 8).toUpperCase();
  const customerName = order.user?.name || "Misafirimiz";
  const subject = `Siparişiniz Onaylandı! #${orderNumber} - TUA Design`;

  // Tarih formatı
  const date = new Date(order.createdAt).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Ürünleri HTML tablosuna dönüştür
  const itemsHtml = (order.items || [])
    .map((item) => {
      const p = item.product || {};
      const name = p.name || "Ürün";
      // Renk/Beden bilgisi
      const variantInfo = [item.colorLabel, item.sizeLabel]
        .filter(Boolean)
        .join(" | ");

      // Ürün görseli (Varsa kullanılır, yoksa gri kutu)
      // Not: E-postalarda görsel URL'leri tam (absolute) olmalıdır. 
      // Örn: https://siteniz.com/images/...
      // Burada temsili bir stil kullanıyoruz.
      const imageStyle = `
        width: 60px; 
        height: 80px; 
        object-fit: cover; 
        border-radius: 4px; 
        background-color: #f5f5f5;
        display: block;
      `;

      return `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #eee; width: 70px;">
             ${
               // Eğer görsel URL'i http ile başlıyorsa göster, yoksa placeholder
               // Gerçek hayatta p.images[0].url kullanırsınız.
               `<div style="${imageStyle}"></div>` 
             }
          </td>
          <td style="padding: 16px 0; border-bottom: 1px solid #eee;">
            <div style="font-size: 14px; font-weight: bold; color: #000;">${name}</div>
            ${
              variantInfo
                ? `<div style="font-size: 12px; color: #888; margin-top: 4px;">${variantInfo}</div>`
                : ""
            }
            <div style="font-size: 12px; color: #888; margin-top: 4px;">Adet: ${item.quantity}</div>
          </td>
          <td style="padding: 16px 0; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">
            <div style="font-size: 14px; font-weight: bold; color: #000;">${tl(item.price)}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Adres formatı
  const address = `
    ${order.shippingName || ""}<br/>
    ${order.shippingAddressLine || ""}<br/>
    ${order.shippingDistrict || ""} / ${order.shippingCity || ""}
    ${order.shippingPostalCode ? `(${order.shippingPostalCode})` : ""}
    ${order.shippingPhone ? `<br/>Tel: ${order.shippingPhone}` : ""}
  `;

  // --- HTML ŞABLONU ---
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sipariş Onayı</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fdfbf7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <!-- Ana Taşıyıcı -->
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fdfbf7; padding: 40px 0;">
    <tr>
      <td align="center">
        
        <!-- İçerik Kartı -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          
          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding: 40px 0 30px 0; background-color: #ffffff; border-bottom: 4px solid #D4AF37;">
              <!-- Logo Yerine Metin (Logonuzun URL'si varsa img etiketiyle değiştirin) -->
              <h1 style="margin: 0; font-family: 'Times New Roman', serif; font-size: 32px; letter-spacing: 4px; color: #000;">TUA</h1>
              <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #D4AF37; display: block; margin-top: 5px;">Her Bedende Işıltı</span>
            </td>
          </tr>

          <!-- Mesaj -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #000; font-weight: 300;">Teşekkürler, ${customerName}</h2>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #666;">
                Siparişinizi aldık ve çok mutlu olduk. Ürünlerinizi özenle hazırlamaya başlıyoruz. 
                Kargoya verildiğinde sizi tekrar bilgilendireceğiz.
              </p>
            </td>
          </tr>

          <!-- Sipariş Özeti Kutusu -->
          <tr>
            <td style="padding: 0 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #faf9f6; border-radius: 12px; padding: 20px;">
                <tr>
                  <td align="center" width="33%" style="border-right: 1px solid #e5e5e5;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">SİPARİŞ NO</div>
                    <div style="font-size: 16px; font-weight: bold; color: #000;">#${orderNumber}</div>
                  </td>
                  <td align="center" width="33%" style="border-right: 1px solid #e5e5e5;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">TARİH</div>
                    <div style="font-size: 16px; font-weight: bold; color: #000;">${date}</div>
                  </td>
                  <td align="center" width="33%">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">TOPLAM</div>
                    <div style="font-size: 16px; font-weight: bold; color: #D4AF37;">${tl(order.total)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ürünler Listesi -->
          <tr>
            <td style="padding: 30px 40px;">
              <div style="font-size: 12px; font-weight: bold; color: #000; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">Sipariş Detayı</div>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                ${itemsHtml}
              </table>

              <!-- Toplamlar -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px;">
                <tr>
                  <td align="right" style="padding-top: 10px; font-size: 14px; color: #666;">Ara Toplam:</td>
                  <td align="right" style="padding-top: 10px; font-size: 14px; color: #000; width: 100px; font-weight: bold;">${tl(order.total)}</td>
                </tr>
                <tr>
                  <td align="right" style="padding-top: 5px; font-size: 14px; color: #666;">Kargo:</td>
                  <td align="right" style="padding-top: 5px; font-size: 14px; color: #22c55e; width: 100px; font-weight: bold;">Ücretsiz</td>
                </tr>
                <tr>
                  <td align="right" style="padding-top: 15px; font-size: 18px; font-weight: bold; color: #000;">Genel Toplam:</td>
                  <td align="right" style="padding-top: 15px; font-size: 18px; font-weight: bold; color: #D4AF37; width: 100px;">${tl(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Adres ve Notlar -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" width="50%" style="padding-right: 20px;">
                    <div style="font-size: 12px; font-weight: bold; color: #000; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Teslimat Adresi</div>
                    <div style="font-size: 14px; color: #555; line-height: 1.6;">
                      ${address}
                    </div>
                  </td>
                  ${
                    order.customerNote
                      ? `
                  <td valign="top" width="50%" style="padding-left: 20px; background-color: #fffdf5; border: 1px dashed #eaddb8; border-radius: 8px; padding: 15px;">
                    <div style="font-size: 11px; font-weight: bold; color: #D4AF37; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Sipariş Notunuz</div>
                    <div style="font-size: 13px; color: #555; font-style: italic;">
                      "${order.customerNote}"
                    </div>
                  </td>
                  `
                      : ""
                  }
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #111; padding: 30px 40px;">
              <p style="margin: 0 0 10px 0; color: #fff; font-size: 14px; letter-spacing: 1px;">TUA GİYİM</p>
              <p style="margin: 0; color: #666; font-size: 12px;">
                Ruhunuza dokunan tasarımlar.
              </p>
              <div style="margin-top: 20px; font-size: 11px; color: #444;">
                © ${new Date().getFullYear()} Tüm hakları saklıdır.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;

  return { subject, html };
}
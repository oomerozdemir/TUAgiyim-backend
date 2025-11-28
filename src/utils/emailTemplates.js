const tl = (n) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

// --- ORTAK STİLLER (Tekrarı önlemek için) ---
const styles = {
  body: "margin: 0; padding: 0; background-color: #fdfbf7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;",
  container: "background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);",
  header: "padding: 40px 0 30px 0; background-color: #ffffff; border-bottom: 4px solid #D4AF37;",
  brand: "margin: 0; font-family: 'Times New Roman', serif; font-size: 32px; letter-spacing: 4px; color: #000;",
  subBrand: "font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #D4AF37; display: block; margin-top: 5px;",
  content: "padding: 40px 40px 20px 40px; text-align: center;",
  title: "margin: 0 0 16px 0; font-size: 24px; color: #000; font-weight: 300;",
  text: "margin: 0; font-size: 15px; line-height: 1.6; color: #666;",
  button: "display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-size: 14px; font-weight: bold; margin-top: 20px;",
  footer: "background-color: #111; padding: 30px 40px; text-align: center; color: #666; font-size: 12px;"
};

/**
 * 1. Sipariş Onay Maili (Mevcut)
 */
export function buildOrderConfirmationEmail(order) {
  const orderNumber = order.orderNumber || order.id?.slice(0, 8).toUpperCase();
  const customerName = order.user?.name || "Misafirimiz";
  const subject = `Siparişiniz Onaylandı! #${orderNumber} - TUA Giyim`;

  const itemsHtml = (order.items || []).map((item) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
        <div style="font-size: 14px; font-weight: bold; color: #000;">${item.product?.name}</div>
        <div style="font-size: 12px; color: #888;">Adet: ${item.quantity} | ${tl(item.price)}</div>
      </td>
    </tr>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="${styles.body}">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="${styles.container}">
          <tr>
            <td align="center" style="${styles.header}">
              <h1 style="${styles.brand}">TUA</h1>
              <span style="${styles.subBrand}">Her Bedende Işıltı</span>
            </td>
          </tr>
          <tr>
            <td style="${styles.content}">
              <h2 style="${styles.title}">Teşekkürler, ${customerName}</h2>
              <p style="${styles.text}">
                Siparişinizi aldık (#${orderNumber}). Ürünlerinizi özenle hazırlamaya başlıyoruz.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                ${itemsHtml}
                <tr>
                  <td align="right" style="padding-top: 15px; font-size: 18px; font-weight: bold;">
                    Toplam: <span style="color: #D4AF37;">${tl(order.total)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="${styles.footer}">© TUA Giyim</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * 2. Kargoya Verildi Maili (YENİ)
 */
export function buildOrderShippedEmail(order) {
  const orderNumber = order.orderNumber || order.id?.slice(0, 8).toUpperCase();
  const customerName = order.user?.name || "Değerli Müşterimiz";
  const subject = `Siparişiniz Kargoya Verildi! 🚚 #${orderNumber}`;
  
  const trackingNumber = order.cargoTrackingNumber || "Belirtilmemiş";
  const cargoCompany = order.cargoCompany || "Kargo Firması";

  const html = `
<!DOCTYPE html>
<html>
<body style="${styles.body}">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="${styles.container}">
          <tr>
            <td align="center" style="${styles.header}">
              <h1 style="${styles.brand}">TUA</h1>
              <span style="${styles.subBrand}">Yola Çıktı</span>
            </td>
          </tr>
          <tr>
            <td style="${styles.content}">
              <h2 style="${styles.title}">Müjde! Siparişiniz Yolda.</h2>
              <p style="${styles.text}">
                Merhaba ${customerName}, #${orderNumber} numaralı siparişiniz paketlendi ve kargo firmasına teslim edildi.
              </p>
              
              <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 25px; text-align: left;">
                <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">KARGO FİRMASI</div>
                <div style="font-size: 16px; font-weight: bold; color: #000; margin-bottom: 10px;">${cargoCompany}</div>
                
                <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">TAKİP NUMARASI</div>
                <div style="font-size: 18px; font-weight: bold; color: #D4AF37; font-family: monospace;">${trackingNumber}</div>
              </div>

              <a href="http://tuagiyim.com/hesabim?tab=orders" style="${styles.button}">Siparişimi Takip Et</a>
            </td>
          </tr>
          <tr><td style="${styles.footer}">© TUA Giyim - Sorularınız için yanıtlayın.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * 3. Teslim Edildi Maili (YENİ)
 */
export function buildOrderDeliveredEmail(order) {
  const orderNumber = order.orderNumber || order.id?.slice(0, 8).toUpperCase();
  const customerName = order.user?.name || "Değerli Müşterimiz";
  const subject = `Teslimat Başarılı! 🎉 #${orderNumber}`;

  const html = `
<!DOCTYPE html>
<html>
<body style="${styles.body}">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="${styles.container}">
          <tr>
            <td align="center" style="${styles.header}">
              <h1 style="${styles.brand}">TUA</h1>
              <span style="${styles.subBrand}">Güle Güle Kullanın</span>
            </td>
          </tr>
          <tr>
            <td style="${styles.content}">
              <h2 style="${styles.title}">Kavuştunuz!</h2>
              <p style="${styles.text}">
                Merhaba ${customerName}, #${orderNumber} numaralı siparişinizin size ulaştığı bilgisini aldık.
                Umarız ürünlerinizi çok beğenirsiniz ve güzel günlerde kullanırsınız.
              </p>
              <br/>
              <p style="${styles.text}">
                Deneyiminizi paylaşmak ve diğer müşterilerimize fikir vermek ister misiniz?
              </p>

              <a href="http://tuagiyim.com/hesabim?tab=orders" style="${styles.button}">Ürünleri Değerlendir</a>
            </td>
          </tr>
          <tr><td style="${styles.footer}">© TUA Giyim - Bir sorununuz varsa bizimle iletişime geçin.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
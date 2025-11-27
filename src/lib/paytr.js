import crypto from "crypto";

const merchant_id = process.env.PAYTR_MERCHANT_ID;
const merchant_key = process.env.PAYTR_MERCHANT_KEY;
const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

/**
 * PayTR iFrame Token Oluşturma
 */
export const getPaytrToken = async ({
  user_ip,
  merchant_oid,
  email,
  payment_amount, // 9.99 formatında olmalı (kuruslu ise nokta) veya 100 ile çarpılmış değil, doğrudan TL
  user_name,
  user_address,
  user_phone,
  user_basket, // HTML encoded JSON string: [['Ürün Adı', 'Fiyat', 'Adet'], ...]
  debug_on = 1, // Canlıda 0 yapın
  timeout_limit = 30,
  test_mode = 1 // Canlıda 0 yapın
}) => {
  
  // PayTR tutarı 100 ile çarpıp ister (Örn: 10.50 TL -> 1050) ANCAK bazı entegrasyon tiplerinde direkt TL ister.
  // İframe API dökümanına göre: "paytr_token" alırken amount * 100 şeklinde gönderilmelidir.
  const paytr_amount = payment_amount * 100;

  const no_installment = 0; // Taksit yapılsın mı? 0: Evet, 1: Hayır
  const max_installment = 0; // 0: Sınırsız
  const currency = "TL";
  
  // Hash oluşturma sırası kritiktir:
  // merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
  const hash_str = 
    merchant_id + 
    user_ip + 
    merchant_oid + 
    email + 
    paytr_amount + 
    user_basket + 
    no_installment + 
    max_installment + 
    currency + 
    test_mode;

  const paytr_token = crypto
    .createHmac("sha256", merchant_key)
    .update(hash_str + merchant_salt)
    .digest("base64");

  const params = {
    merchant_id,
    user_ip,
    merchant_oid,
    email,
    payment_amount: paytr_amount,
    paytr_token,
    user_basket,
    debug_on,
    no_installment,
    max_installment,
    user_name,
    user_address,
    user_phone,
    merchant_ok_url: `${process.env.APP_URL}/siparis-basarili`, // Frontend başarı sayfası
    merchant_fail_url: `${process.env.APP_URL}/siparis-basarisiz`, // Frontend hata sayfası
    timeout_limit,
    currency,
    test_mode
  };

  // PayTR API'ye istek atıp token (iframe url) alacağız
  // PayTR API Endpoint
  const endpoint = "https://www.paytr.com/odeme/api/get-token";
  
  // Form data formatında post etmek gerekir
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, value);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    return result; // { status: 'success', token: '...' }
  } catch (error) {
    console.error("PayTR Token Hatası:", error);
    throw new Error("Ödeme başlatılamadı.");
  }
};

/**
 * PayTR Callback Hash Doğrulama
 */
export const verifyPaytrHash = (params) => {
  const { merchant_oid, status, total_amount, hash } = params;
  
  const hash_str = merchant_oid + merchant_salt + status + total_amount;
  const calculated_hash = crypto
    .createHmac("sha256", merchant_key)
    .update(hash_str)
    .digest("base64");

  return calculated_hash === hash;
};
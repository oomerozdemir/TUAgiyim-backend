import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

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
  payment_amount,
  user_name,
  user_address,
  user_phone,
  user_basket,
  debug_on = 1,
  timeout_limit = 30,
  test_mode = process.env.PAYTR_TEST_MODE || 1 
}) => {
  
  const paytr_amount = payment_amount * 100;
  const no_installment = 0; 
  const max_installment = 0; 
  const currency = "TL";
  
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

  const merchant_ok_url = process.env.PAYTR_OK_URL || "http://tuagiyim.com/siparis-basarili";
  const merchant_fail_url = process.env.PAYTR_FAIL_URL || "http://tuagiyim.com/siparis-basarisiz";

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
    merchant_ok_url,
    merchant_fail_url,
    timeout_limit,
    currency,
    test_mode
  };

  const endpoint = "https://www.paytr.com/odeme/api/get-token";
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
    return result; 
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
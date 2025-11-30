import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";

export const getSitemap = asyncHandler(async (req, res) => {
  // Site URL'ini env'den alalım (Sonunda / olmamalı)
  const baseUrl = process.env.FRONTEND_URL || "https://tuagiyim.com";

  // 1. Statik Sayfalar
  const staticPages = [
    "",
    "/hakkimizda",
    "/iletisim",
    "/sss",
    "/iade-degisim",
    "/gizlilik-politikasi",
    "/kullanim-kosullari",
    "/mesafeli-satis-sozlesmesi",
  ];

  // 2. Dinamik Verileri Çek (Ürünler ve Kategoriler)
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
  ]);

  // 3. XML Oluşturma Başlangıcı
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Statik Sayfaları Ekle
  staticPages.forEach((page) => {
    xml += `
  <url>
    <loc>${baseUrl}${page}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  // Kategorileri Ekle
  categories.forEach((cat) => {
    xml += `
  <url>
    <loc>${baseUrl}/kategori/${cat.slug}</loc>
    <lastmod>${new Date(cat.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
  });

  // Ürünleri Ekle
  products.forEach((prod) => {
    xml += `
  <url>
    <loc>${baseUrl}/urun/${prod.slug}</loc>
    <lastmod>${new Date(prod.updatedAt).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;
  });

  xml += `
</urlset>`;

  // 4. Yanıtı XML Olarak Gönder
  res.header("Content-Type", "application/xml");
  res.send(xml);
});
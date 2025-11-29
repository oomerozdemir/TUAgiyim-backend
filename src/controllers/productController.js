import prisma from '../prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

 
function normalizeImages(images) {
  if (!Array.isArray(images)) return undefined;
  const rows = images
    .map((img) => {
      if (typeof img === "string") return { url: img, publicId: null };
      if (img && typeof img === "object" && img.url) {
        const row = { url: img.url, publicId: img.publicId || null };
        if (img.colorId) row.colorId = img.colorId;
        return row;
      }
      return null;
    })
    .filter(Boolean);

  const seen = new Set();
  const data = [];
  for (const r of rows) {
    const key = r.publicId || r.url;
    if (seen.has(key)) continue;
    seen.add(key);
    data.push(r);
  }

  // Prisma'da unique ihlali engellemek için
  return data.length ? { createMany: { data, skipDuplicates: true } } : undefined;
}

/**
 * GET /api/products
 */
// ...fonksiyonun başı aynı
export const listProducts = asyncHandler(async (req, res) => {
  const {
    search = '',
    page = 1,
    pageSize = 12,
    sort = 'createdAt:desc',
    featured,
    me,
    category,        
    categorySlug,    
    categoryId,     
  } = req.query;

  const [sortField, sortDir] = String(sort).split(':');
  const take = Math.max(1, Number(pageSize));
  const skip = (Math.max(1, Number(page)) - 1) * take;

  const whereBase = search?.trim()
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  // featured
  const parts = [whereBase];
  if (featured === 'true') parts.push({ featured: true });

  // ✅ kategori filtresi (slug veya id)
  const slug = categorySlug || category;
  if (slug) {
    parts.push({ categories: { some: { slug } } });
  }
  if (categoryId) {
    parts.push({ categories: { some: { id: categoryId } } });
  }

  const where = { AND: parts };

  // (opsiyonel) favori bayrağı için me=true
  const wantMe = String(me) === 'true';
  let favoriteIds = new Set();
  if (wantMe && req.user?.id) {
    const favs = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      select: { productId: true },
    });
    favoriteIds = new Set(favs.map((f) => f.productId));
  }

  const [itemsRaw, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sortField || 'createdAt']: sortDir === 'asc' ? 'asc' : 'desc' },
      skip,
      take,
      include: { images: true, categories: true, sizes: true, colors: true  },
    }),
    prisma.product.count({ where }),
  ]);

  const ratingData = await prisma.review.groupBy({
  by: ["productId"],
  _avg: { rating: true },
  _count: { rating: true },
});

const ratingMap = new Map(
  ratingData.map((r) => [
    r.productId,
    {
      averageRating: r._avg.rating || 0,
      ratingCount: r._count.rating || 0,
    },
  ])
);

// ürünleri favori + rating ile birleştir
const items = itemsRaw.map((p) => ({
  ...p,
  isFavorited: wantMe ? favoriteIds.has(p.id) : false,
  averageRating: ratingMap.get(p.id)?.averageRating || 0,
  ratingCount: ratingMap.get(p.id)?.ratingCount || 0,
}));

res.json({
  items,
  page: Number(page),
  pageSize: take,
  total,
  totalPages: Math.ceil(total / take),
});
});

/**
 * GET /api/products/:id
 */
export const getProduct = asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { 
      images: true, 
      categories: true, 
      sizes: true, 
      colors: true,
      complementary: {
         include: { images: true, sizes: true, colors: true } // Tamamlayıcının detayları
      }
    }, 
  });
  if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });
  
  const rating = await prisma.review.aggregate({
    where: { productId: product.id },
    _avg: { rating: true },
    _count: { rating: true },
  });

  res.json({
    ...product,
    averageRating: rating._avg.rating || 0,
    ratingCount: rating._count.rating || 0,
  });
});

/**
 * POST /api/products
 */
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    description,
    price,
    images = [],
    categoryIds = [],
    featured = false,
    sizes = [],
    colors = [],
    attributes = [],
  } = req.body;

  if (!name || !slug || price === undefined) {
    return res.status(400).json({ message: "name, slug ve price gereklidir" });
  }

  const totalFromSizes = (Array.isArray(sizes) ? sizes : []).reduce(
    (a, s) => a + Number(s.stock || 0),
    0
  );
  const totalFromColors = (Array.isArray(colors) ? colors : []).reduce(
    (a, c) => a + Number(c.stock || 0),
    0
  );
  const totalStock = totalFromSizes > 0 ? totalFromSizes : totalFromColors;

  const imgsCreate = normalizeImages(images);

  const data = {
    name,
    slug,
    description,
    price: Number(price),
    featured: Boolean(featured),
    stock: totalStock,
    ...(imgsCreate ? { images: imgsCreate } : {}),
    ...(Array.isArray(categoryIds) && categoryIds.length
      ? { categories: { connect: categoryIds.map((id) => ({ id })) } }
      : {}),
    ...(Array.isArray(sizes) && sizes.length
      ? {
          sizes: {
            create: sizes.map((s) => ({
              label: s.label,
              stock: Number(s.stock) || 0,
            })),
          },
        }
      : {}),
    ...(Array.isArray(colors) && colors.length
      ? {
          colors: {
            create: colors.map((c) => ({
              label: c.label,
              stock: Number(c.stock) || 0,
            })),
          },
        }
      : {}),
    ...(Array.isArray(attributes) && attributes.length
      ? {
          attributes: attributes.map((a) => ({
            label: String(a.label || "").trim(),
            value: String(a.value || "").trim(),
          })),
        }
      : {}),
  };

  const created = await prisma.$transaction(async (tx) => {
  const p = await tx.product.create({
    data,
    include: { images: true, categories: true, sizes: true, colors: true },
  });

  // Renkli görselleri eşleştir (önce colorLabel’a göre)
  const imagesNeedingRelink = (images || []).filter(
    (im) => im?.colorLabel && im.url
  );

  if (imagesNeedingRelink.length && p.colors?.length) {
    for (const im of imagesNeedingRelink) {
      const color = p.colors.find((c) => c.label === im.colorLabel);
      if (!color) continue;
      const existing = p.images.find((x) =>
        im.publicId ? x.publicId === im.publicId : x.url === im.url
      );
      if (existing) {
        await tx.productImage.update({
          where: { id: existing.id },
          data: { colorId: color.id },
        });
      }
    }
  }
  // ❗ colorLabel yoksa: index'e göre eşleştir (1. renk -> 1. görsel, vb.)
  else if (p.colors?.length && p.images?.length) {
    const len = Math.min(p.colors.length, p.images.length);
    for (let i = 0; i < len; i++) {
      const color = p.colors[i];
      const img = p.images[i];
      if (!color || !img) continue;

      await tx.productImage.update({
        where: { id: img.id },
        data: { colorId: color.id },
      });
    }
  }

  return p;
});

  res.status(201).json(created);
});


/**
 * PUT /api/products/:id
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const {
    name, slug, description, price, featured, images, categoryIds, sizes, colors, attributes,
    complementaryId 
  } = req.body;

  const data = {
    ...(name !== undefined ? { name } : {}),
    ...(slug !== undefined ? { slug } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(price !== undefined ? { price: Number(price) } : {}),
    ...(featured !== undefined ? { featured: !!featured } : {}),
    ...(complementaryId !== undefined ? { complementaryId: complementaryId || null } : {}), // <-- Güncelle
    ...(Array.isArray(categoryIds) ? { categories: { set: categoryIds.map((id) => ({ id })) } } : {}),
  };

  if (Array.isArray(images)) {
    const imgs = normalizeImages(images);
    data.images = { deleteMany: {}, ...(imgs || {}) };
  }

  if (Array.isArray(sizes)) {
    const totalFromSizes = sizes.reduce((a, s) => a + Number(s.stock || 0), 0);
    data.sizes = { deleteMany: {}, create: sizes.map((s) => ({ label: s.label, stock: Number(s.stock) || 0 })) };
    data.stock = totalFromSizes;
  }

  if (Array.isArray(colors)) {
    data.colors = { deleteMany: {}, create: colors.map((c) => ({ label: c.label, stock: Number(c.stock) || 0 })) };
    if (!Array.isArray(sizes)) {
      const totalFromColors = colors.reduce((a, c) => a + Number(c.stock || 0), 0);
      data.stock = totalFromColors;
    }
  }

  if (attributes !== undefined) {
    data.attributes = Array.isArray(attributes) ? attributes.filter((a) => a.label?.trim() && a.value?.trim()).map((a) => ({ label: a.label.trim(), value: a.value.trim() })) : null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({
      where: { id: req.params.id },
      data,
      include: { images: true, categories: true, sizes: true, colors: true },
    });

    const imagesNeedingRelink = (images || []).filter((im) => im?.colorLabel && im.url);

    if (imagesNeedingRelink.length && p.colors?.length) {
      for (const im of imagesNeedingRelink) {
        const color = p.colors.find((c) => c.label === im.colorLabel);
        if (!color) continue;
        const existing = p.images.find((x) => im.publicId ? x.publicId === im.publicId : x.url === im.url);
        if (existing) {
          await tx.productImage.update({ where: { id: existing.id }, data: { colorId: color.id } });
        }
      }
    }
    else if (p.colors?.length && p.images?.length) {
      const len = Math.min(p.colors.length, p.images.length);
      for (let i = 0; i < len; i++) {
        const color = p.colors[i];
        const img = p.images[i];
        if (!color || !img) continue;
        await tx.productImage.update({ where: { id: img.id }, data: { colorId: color.id } });
      }
    }
    return p;
  });

  res.json(updated);
});


/**
 * DELETE /api/products/:id
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });

  const inOrders = await prisma.orderItem.count({ where: { productId: id } });
  if (inOrders > 0) {
    return res
      .status(409)
      .json({ message: 'Bu ürün siparişlerde kullanılıyor, silinemez.' });
  }

  await prisma.product.update({
    where: { id },
    data: { categories: { set: [] } },
  });

  await prisma.product.delete({ where: { id } });
  res.json({ ok: true, message: 'Ürün silindi' });
});

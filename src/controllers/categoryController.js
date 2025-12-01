import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";

/**
 * GET /api/categories
 */
export const listCategories = asyncHandler(async (req, res) => {
  const { tree, search } = req.query;

  // Arama filtresi
  const where = search?.trim()
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  if (tree === 'true') {
    const rootCategories = await prisma.category.findMany({
      where: { ...where, parentId: null }, // Sadece ana kategoriler
      include: { 
        children: {
          orderBy: { name: 'asc' },
          include: { _count: { select: { products: true } } }
        } 
      },
      orderBy: { createdAt: "desc" }, // veya name: 'asc'
    });
    return res.json(rootCategories);
  }

  const items = await prisma.category.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { 
      parent: true,
      children: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, imageUrl: true, _count: true } // Alt kategorinin detayları
      }
    } 
  });
  res.json(items);
});
/**
 * GET /api/categories/:id
 */
export const getCategory = asyncHandler(async (req, res) => {
  const item = await prisma.category.findUnique({
    where: { id: req.params.id },
    include: { parent: true, children: true }
  });
  if (!item) return res.status(404).json({ message: "Kategori bulunamadı" });
  res.json(item);
});

/**
 * POST /api/categories
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, imageUrl, publicId, parentId, isFeatured } = req.body; // isFeatured eklendi
  if (!name || !slug) return res.status(400).json({ message: "name ve slug gerekli" });

  const item = await prisma.category.create({
    data: {
      name,
      slug,
      imageUrl: imageUrl || null,
      publicId: publicId || null,
      parentId: parentId || null,
      isFeatured: Boolean(isFeatured), 
    },
  });
  res.status(201).json(item);
});

/**
 * PUT /api/categories/:id
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const { name, slug, imageUrl, publicId, parentId, isFeatured } = req.body; // isFeatured eklendi

  const data = {
    ...(name !== undefined ? { name } : {}),
    ...(slug !== undefined ? { slug } : {}),
    ...(parentId !== undefined ? { parentId: parentId || null } : {}),
    ...(isFeatured !== undefined ? { isFeatured: Boolean(isFeatured) } : {}), // Güncelleme
  };

  if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
  if (publicId !== undefined) data.publicId = publicId || null;

  if (data.parentId === req.params.id) {
    return res.status(400).json({ message: "Kategori kendi altına taşınamaz." });
  }

  const updated = await prisma.category.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
import asyncHandler from "express-async-handler";
import prisma from "../prisma.js";

/**
 * GET /api/categories
 */
export const listCategories = asyncHandler(async (req, res) => {
  const { tree } = req.query;

  // Eğer ağaç yapısı isteniyorsa sadece Ana Kategorileri (parentId: null) çek
  // ve yanlarında çocuklarını getir.
  if (tree === 'true') {
    const rootCategories = await prisma.category.findMany({
      where: { parentId: null }, 
      include: { 
        children: {
          orderBy: { name: 'asc' } 
        } 
      },
      orderBy: { name: 'asc' },
    });
    return res.json(rootCategories);
  }

  const items = await prisma.category.findMany({
    orderBy: { createdAt: "desc" },
    include: { parent: true } // Hangi ana kategoriye ait olduğunu görmek için
  });
  res.json(items);
});

/**
 * GET /api/categories/:id
 */
export const getCategory = asyncHandler(async (req, res) => {
  const item = await prisma.category.findUnique({
    where: { id: req.params.id },
  });
  if (!item) return res.status(404).json({ message: "Kategori bulunamadı" });
  res.json(item);
});

/**
 * POST /api/categories
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, imageUrl, publicId, parentId } = req.body;
  if (!name || !slug)
    return res.status(400).json({ message: "name ve slug gerekli" });

  const item = await prisma.category.create({
    data: {
      name,
      slug,
      imageUrl: imageUrl || null,
      publicId: publicId || null,
      parentId: parentId || null, 
    },
  });
  res.status(201).json(item);
});

/**
 * PUT /api/categories/:id
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const { name, slug, imageUrl, publicId, parentId } = req.body; 

  const data = {
    ...(name !== undefined ? { name } : {}),
    ...(slug !== undefined ? { slug } : {}),
    ...(parentId !== undefined ? { parentId: parentId || null } : {}), 
  };

  if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
  if (publicId !== undefined) data.publicId = publicId || null;

  if (data.parentId === req.params.id) {
    return res.status(400).json({ message: "Bir kategori kendisinin alt kategorisi olamaz." });
  }

  const updated = await prisma.category.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/**
 * DELETE /api/categories/:id
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

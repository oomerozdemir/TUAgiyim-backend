import prisma from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/account/addresses
export const getAddresses = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "desc" },
    ],
  });

  res.json(addresses);
});

// POST /api/account/addresses
export const createAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    title = "Ev",
    fullName,
    phone,
    city,
    district,
    neighborhood,
    addressLine,
    postalCode,
    isDefault = false,
  } = req.body;

  if (!fullName || !phone || !city || !district || !addressLine) {
    return res
      .status(400)
      .json({ message: "Zorunlu alanları doldurunuz." });
  }

  let defaultFlag = Boolean(isDefault);

  const result = await prisma.$transaction(async (tx) => {
    // İlk adres ise otomatik varsayılan yap
    const count = await tx.address.count({ where: { userId } });
    if (count === 0) defaultFlag = true;

    // Eğer bu adres varsayılan olacaksa, diğerlerini kapat
    if (defaultFlag) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.address.create({
      data: {
        userId,
        title,
        fullName,
        phone,
        city,
        district,
        neighborhood,
        addressLine,
        postalCode,
        isDefault: defaultFlag,
      },
    });

    return created;
  });

  res.status(201).json(result);
});

// PUT /api/account/addresses/:id
export const updateAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const {
    title,
    fullName,
    phone,
    city,
    district,
    neighborhood,
    addressLine,
    postalCode,
    isDefault,
  } = req.body;

  const address = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!address) return res.status(404).json({ message: "Adres bulunamadı." });

  const updated = await prisma.$transaction(async (tx) => {
    let defaultFlag = isDefault;

    if (defaultFlag === true) {
      // Bu adres varsayılan olsun, diğerlerini kapat
      await tx.address.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const addr = await tx.address.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(fullName !== undefined && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(city !== undefined && { city }),
        ...(district !== undefined && { district }),
        ...(neighborhood !== undefined && { neighborhood }),
        ...(addressLine !== undefined && { addressLine }),
        ...(postalCode !== undefined && { postalCode }),
        ...(defaultFlag !== undefined && { isDefault: defaultFlag }),
      },
    });

    return addr;
  });

  res.json(updated);
});

// DELETE /api/account/addresses/:id
export const deleteAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const address = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!address) return res.status(404).json({ message: "Adres bulunamadı." });

  await prisma.address.delete({ where: { id } });

  res.json({ ok: true });
});

// POST /api/account/addresses/:id/default
export const setDefaultAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const address = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!address) return res.status(404).json({ message: "Adres bulunamadı." });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return tx.address.update({
      where: { id },
      data: { isDefault: true },
    });
  });

  res.json(updated);
});

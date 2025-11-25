import prisma from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * POST /api/contact
 * Ziyaretçi mesaj gönderir (Public)
 */
export const createMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: "Lütfen gerekli alanları doldurun." });
  }

  const newMessage = await prisma.contactMessage.create({
    data: {
      name,
      email,
      subject,
      message,
    },
  });

  res.status(201).json({ message: "Mesajınız başarıyla gönderildi.", data: newMessage });
});

/**
 * GET /api/contact
 * Tüm mesajları getir (Admin)
 */
export const getMessages = asyncHandler(async (req, res) => {
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(messages);
});

/**
 * DELETE /api/contact/:id
 * Mesajı sil (Admin)
 */
export const deleteMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.contactMessage.delete({ where: { id } });
  res.json({ message: "Mesaj silindi." });
});

/**
 * PATCH /api/contact/:id/read
 * Mesajı okundu/okunmadı yap (Admin)
 */
export const toggleReadStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const message = await prisma.contactMessage.findUnique({ where: { id } });
  
  if (!message) return res.status(404).json({ message: "Mesaj bulunamadı" });

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { isRead: !message.isRead },
  });

  res.json(updated);
});
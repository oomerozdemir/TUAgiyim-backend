// src/controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const genAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });

const genRefreshToken = (id) =>
  jwt.sign({ id }, process.env.REFRESH_SECRET, { expiresIn: "30d" });

// ✅ DÜZELTME: Cross-Domain Cookie Ayarları
// Frontend (Vercel) ve Backend (Render) farklı domainlerde olduğu için
// SameSite: 'None' ve Secure: true şarttır.
const setRefreshCookie = (res, token) => {
  res.cookie("rt", token, {
    httpOnly: true,
    sameSite: "None", // ÖNEMLİ: Cross-site istekler için 'None' olmalı
    secure: true,     // ÖNEMLİ: 'None' kullanıldığında Secure true olmalı (HTTPS)
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

// POST /api/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email ve parola gerekli" });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ message: "Bu email zaten kayıtlı" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, password: hashed } });

  const accessToken = genAccessToken(user.id);
  const refreshToken = genRefreshToken(user.id);
  
  // Güncellenmiş cookie fonksiyonunu kullanır
  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    accessToken,
    token: accessToken,
    refreshToken, // Fallback olarak body'de de dönüyoruz
  });
});

// POST /api/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email ve parola gerekli" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Parola hatalı" });

  const accessToken = genAccessToken(user.id);
  const refreshToken = genRefreshToken(user.id);
  
  setRefreshCookie(res, refreshToken);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    accessToken,
    token: accessToken,
    refreshToken,
  });
});

// POST /api/auth/refresh
export const refreshToken = asyncHandler(async (req, res) => {
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  
  // Cookie, Header veya Body'den token ara
  const rt = req.cookies?.rt || bearer || req.body?.rt;

  if (!rt) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(rt, process.env.REFRESH_SECRET);
    const newAccess = genAccessToken(payload.id);
    const newRefresh = genRefreshToken(payload.id);
    
    setRefreshCookie(res, newRefresh);
    
    return res.json({ accessToken: newAccess, token: newAccess, refreshToken: newRefresh });
  } catch (e) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

// GET /api/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(user);
});

// POST /api/auth/logout
export const logout = (req, res) => {
  res.clearCookie("rt", {
    httpOnly: true,
    sameSite: "None", // Çıkış yaparken de aynı ayarlarla silmeliyiz
    secure: true,
    path: "/",
  });
  return res.json({ ok: true });
};

// PUT /api/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, email } = req.body;

  if (!name && !email) {
    return res.status(400).json({ message: "Güncellenecek bir alan yok." });
  }

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return res.status(400).json({ message: "Bu email başka bir kullanıcıda kayıtlı." });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  res.json(updated);
});

// PUT /api/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Mevcut ve yeni parola zorunlu." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Yeni parola en az 6 karakter olmalı." });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    return res.status(400).json({ message: "Mevcut parola hatalı." });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  res.json({ ok: true, message: "Parola başarıyla güncellendi." });
});
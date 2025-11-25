import cloudinary from '../utils/cloudinary.js';
import asyncHandler from 'express-async-handler';

const uploadBuffer = ({ buffer, folder }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });


export const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ message: 'En az bir resim dosyası göndermelisiniz.' });
  }
  const folder = req.query.folder || 'products';

  const results = await Promise.all(
    req.files.map(async (f) => {
      const r = await uploadBuffer({ buffer: f.buffer, folder });
      return {
        url: r.secure_url,
        publicId: r.public_id,
        width: r.width,
        height: r.height,
        bytes: r.bytes,
        format: r.format,
      };
    })
  );

  res.status(201).json({ files: results });
});

// DELETE /api/upload/:publicId
export const deleteImage = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  if (!publicId) return res.status(400).json({ message: 'publicId gerekli' });

  const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  // result: { result: 'ok' | 'not found' | ... }
  res.json(result);
});

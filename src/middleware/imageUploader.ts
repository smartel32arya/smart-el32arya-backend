import { v2 as cloudinary } from 'cloudinary'
import multer, { FileFilterCallback, MulterError } from 'multer'
import { Request, Response, NextFunction } from 'express'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('INVALID_FILE_TYPE'))
  }
}

// Store in memory — we'll stream buffers to Cloudinary
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
})

// Upload a single buffer to Cloudinary, returns the secure URL
export async function uploadToCloudinary(buffer: Buffer, mimetype: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'smart-realestate/properties',
        resource_type: 'image',
        format: mimetype === 'image/webp' ? 'webp' : undefined,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'))
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

export const handleUploadError = (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت' })
      return
    }
  }
  if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
    res.status(400).json({ message: 'نوع الملف غير مدعوم. يُسمح فقط بـ JPEG و PNG و WebP' })
    return
  }
  next(err)
}

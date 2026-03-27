import { v2 as cloudinary } from 'cloudinary'
import multer, { FileFilterCallback, MulterError, StorageEngine } from 'multer'
import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { config } from '../config'
import { AppError } from '../errors/AppError'

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key:    config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
})

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100 MB

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (file.fieldname === 'video') {
    if (ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('INVALID_VIDEO_TYPE'))
    }
  } else {
    if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('INVALID_FILE_TYPE'))
    }
  }
}

// Custom storage engine: stores file in memory (buffer) AND sets a unique filename
class MemoryStorageWithFilename implements StorageEngine {
  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: Partial<Express.Multer.File>) => void
  ) {
    const chunks: Buffer[] = []
    file.stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    file.stream.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const ext = path.extname(file.originalname) || ''
      const filename = `${uuidv4()}${ext}`
      cb(null, { buffer, filename, size: buffer.length })
    })
    file.stream.on('error', cb)
  }

  _removeFile(
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null) => void
  ) {
    cb(null)
  }
}

// Store in memory with unique filename — buffers available for Cloudinary streaming
// fileSize limit is enforced per-field in handleUploadError since multer applies one limit globally
export const upload = multer({
  storage: new MemoryStorageWithFilename(),
  fileFilter,
  limits: { fileSize: MAX_VIDEO_SIZE }, // use the larger limit; image size is validated in uploadToCloudinary
})

// Upload a single buffer to Cloudinary, returns the secure URL
export async function uploadToCloudinary(buffer: Buffer, mimetype: string): Promise<string> {
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new AppError(400, 'حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت')
  }
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

// Upload a single video buffer to Cloudinary, returns the secure URL
export async function uploadVideoToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'smart-realestate/properties', resource_type: 'video' },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary video upload failed'))
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

// Extract Cloudinary public_id from a secure URL
function publicIdFromUrl(url: string, resourceType: 'image' | 'video' = 'image'): string {
  // e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.ext
  const match = url.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/)
  return match ? match[1] : url
}

// Delete a file from Cloudinary by its secure URL (fire-and-forget safe)
export async function deleteFromCloudinary(
  url: string,
  resourceType: 'image' | 'video' = 'image'
): Promise<void> {
  try {
    const publicId = publicIdFromUrl(url, resourceType)
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
  } catch {
    // Non-fatal — log but don't throw
    console.warn(`[Cloudinary] Failed to delete ${url}`)
  }
}

export const handleUploadError = (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'حجم الملف كبير جداً. الحد الأقصى 100 ميجابايت للفيديو و 5 ميجابايت للصور' })
      return
    }
  }
  if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
    res.status(400).json({ message: 'نوع الملف غير مدعوم. يُسمح فقط بـ JPEG و PNG و WebP' })
    return
  }
  if (err instanceof Error && err.message === 'INVALID_VIDEO_TYPE') {
    res.status(400).json({ message: 'نوع الفيديو غير مدعوم. يُسمح فقط بـ MP4 و MOV و AVI و WebM' })
    return
  }
  next(err)
}

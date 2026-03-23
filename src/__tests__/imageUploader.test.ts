import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import path from 'path'
import fs from 'fs'
import fc from 'fast-check'
import { upload, handleUploadError } from '../middleware/imageUploader'

// Ensure uploads/properties/ directory exists before tests
const UPLOAD_DIR = path.resolve('uploads/properties')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Minimal express app for testing
const app = express()

app.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => upload.array('images')(req, res, next),
  (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[]
    res.status(200).json({ files: files?.map(f => ({ filename: f.filename, mimetype: f.mimetype, size: f.size })) ?? [] })
  },
  handleUploadError
)

// Track uploaded files for cleanup
const uploadedFiles: string[] = []

afterAll(() => {
  // Clean up uploaded files
  for (const filePath of uploadedFiles) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {
      // ignore cleanup errors
    }
  }
})

// Helper: create a buffer of a given size
function makeBuffer(sizeBytes: number): Buffer {
  return Buffer.alloc(sizeBytes, 0x42)
}

// Helper: send upload request and track files
async function uploadFile(buffer: Buffer, mimeType: string, filename: string) {
  const res = await request(app)
    .post('/upload')
    .attach('images', buffer, { filename, contentType: mimeType })

  if (res.status === 200 && res.body.files) {
    for (const f of res.body.files) {
      uploadedFiles.push(path.join(UPLOAD_DIR, f.filename))
    }
  }

  return res
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 16: MIME type validation
// ─────────────────────────────────────────────────────────────────────────────

test('Property 16: Upload image/jpeg → 200 accepted', async () => {
  const res = await uploadFile(makeBuffer(1024), 'image/jpeg', 'test.jpg')
  expect(res.status).toBe(200)
})

test('Property 16: Upload image/png → 200 accepted', async () => {
  const res = await uploadFile(makeBuffer(1024), 'image/png', 'test.png')
  expect(res.status).toBe(200)
})

test('Property 16: Upload image/webp → 200 accepted', async () => {
  const res = await uploadFile(makeBuffer(1024), 'image/webp', 'test.webp')
  expect(res.status).toBe(200)
})

test('Property 16: Upload text/plain → 400 with error message', async () => {
  const res = await uploadFile(makeBuffer(1024), 'text/plain', 'test.txt')
  expect(res.status).toBe(400)
  expect(res.body).toHaveProperty('message')
})

test('Property 16: Upload application/pdf → 400 with error message', async () => {
  const res = await uploadFile(makeBuffer(1024), 'application/pdf', 'test.pdf')
  expect(res.status).toBe(400)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 17: File size limit
// ─────────────────────────────────────────────────────────────────────────────

test('Property 17: Upload file <= 5MB → 200 accepted', async () => {
  // Use 1 byte under 5MB since multer's limit is exclusive at the boundary
  const underFiveMB = 5 * 1024 * 1024 - 1
  const res = await uploadFile(makeBuffer(underFiveMB), 'image/jpeg', 'under5mb.jpg')
  expect(res.status).toBe(200)
})

test('Property 17: Upload file > 5MB → 400 with error message', async () => {
  const overFiveMB = 5 * 1024 * 1024 + 1
  const res = await uploadFile(makeBuffer(overFiveMB), 'image/jpeg', 'over5mb.jpg')
  expect(res.status).toBe(400)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 18: Unique filenames
// ─────────────────────────────────────────────────────────────────────────────

test('Property 18: Upload two files → their filenames should be different', async () => {
  const res1 = await uploadFile(makeBuffer(1024), 'image/jpeg', 'file1.jpg')
  const res2 = await uploadFile(makeBuffer(1024), 'image/jpeg', 'file2.jpg')

  expect(res1.status).toBe(200)
  expect(res2.status).toBe(200)

  const filename1 = res1.body.files[0].filename
  const filename2 = res2.body.files[0].filename

  expect(filename1).not.toBe(filename2)
})

// Feature: smart-realestate-backend, Property 18: for any two separate uploads, filenames are different
test('Property 18 (fast-check): any two separate uploads produce different filenames', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 512, max: 4096 }),
      fc.integer({ min: 512, max: 4096 }),
      async (size1, size2) => {
        const res1 = await uploadFile(makeBuffer(size1), 'image/jpeg', 'a.jpg')
        const res2 = await uploadFile(makeBuffer(size2), 'image/jpeg', 'b.jpg')

        expect(res1.status).toBe(200)
        expect(res2.status).toBe(200)

        const filename1 = res1.body.files[0].filename
        const filename2 = res2.body.files[0].filename

        return filename1 !== filename2
      }
    ),
    { numRuns: 50 }
  )
}, 120000)

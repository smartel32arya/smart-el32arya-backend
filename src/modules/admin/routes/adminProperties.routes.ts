import { Router } from 'express'
import { AdminPropertyController } from '../controllers/AdminPropertyController'
import { upload, handleUploadError } from '../../../middleware/imageUploader'
import { requirePropertyOwnership } from '../../../middleware/requirePropertyOwnership'

const controller = new AdminPropertyController()
const imageUpload = upload.fields([{ name: 'images' }])
const videoUpload = upload.fields([{ name: 'video', maxCount: 1 }])
const mediaUpload = upload.fields([{ name: 'file', maxCount: 1 }])

export const adminPropertiesRouter = Router()

// ── Read ──────────────────────────────────────────────────────────────────
adminPropertiesRouter.get('/',    controller.listProperties)
adminPropertiesRouter.get('/:id', requirePropertyOwnership, controller.getById)

// ── Standalone upload ─────────────────────────────────────────────────────
adminPropertiesRouter.post('/upload', mediaUpload, handleUploadError, controller.uploadMedia)

// ── Core data (JSON) ──────────────────────────────────────────────────────
adminPropertiesRouter.post('/',    controller.createProperty)
adminPropertiesRouter.put('/:id',  requirePropertyOwnership, controller.updatePropertyData)

// ── Images ────────────────────────────────────────────────────────────────
adminPropertiesRouter.post('/:id/images', requirePropertyOwnership, imageUpload, handleUploadError, controller.uploadImages)
adminPropertiesRouter.put('/:id/images',  requirePropertyOwnership, imageUpload, handleUploadError, controller.replaceImages)

// ── Video ─────────────────────────────────────────────────────────────────
adminPropertiesRouter.post('/:id/video',   requirePropertyOwnership, videoUpload, handleUploadError, controller.uploadVideo)
adminPropertiesRouter.put('/:id/video',    requirePropertyOwnership, videoUpload, handleUploadError, controller.replaceVideo)
adminPropertiesRouter.delete('/:id/video', requirePropertyOwnership, controller.removeVideo)

// ── Delete ────────────────────────────────────────────────────────────────
adminPropertiesRouter.delete('/:id', requirePropertyOwnership, controller.deleteProperty)

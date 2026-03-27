import { Router } from 'express'
import { AdminPropertyController } from '../controllers/AdminPropertyController'
import { upload, handleUploadError } from '../../../middleware/imageUploader'
import { requirePropertyOwnership } from '../../../middleware/requirePropertyOwnership'

const controller = new AdminPropertyController()

export const adminPropertiesRouter = Router()

// list — scoped in controller by addedBy for property_admin
adminPropertiesRouter.get('/', controller.listProperties)

// get by id, update, delete — ownership enforced by middleware
adminPropertiesRouter.get('/:id',    requirePropertyOwnership, controller.getById)
adminPropertiesRouter.put(
  '/:id',
  requirePropertyOwnership,
  upload.fields([{ name: 'images' }, { name: 'video', maxCount: 1 }]),
  handleUploadError,
  controller.updateProperty
)
adminPropertiesRouter.delete('/:id', requirePropertyOwnership, controller.deleteProperty)

// create — no ownership check needed (addedBy is set from the token)
adminPropertiesRouter.post(
  '/',
  upload.fields([{ name: 'images' }, { name: 'video', maxCount: 1 }]),
  handleUploadError,
  controller.createProperty
)

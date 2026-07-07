import { Router } from 'express'
import { CloudinaryController } from '../controllers/CloudinaryController'

const controller = new CloudinaryController()

export const cloudinaryRouter = Router()

cloudinaryRouter.get('/sign', controller.signUpload)

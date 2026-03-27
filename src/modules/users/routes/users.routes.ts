import { Router } from 'express'
import { ProfileController } from '../controllers/ProfileController'
import { authenticate } from '../../../middleware/authenticate'

const controller = new ProfileController()

export const usersRouter = Router()

usersRouter.get('/me',  authenticate, controller.getProfile)
usersRouter.put('/me',  authenticate, controller.updateProfile)

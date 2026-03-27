import { Router } from 'express'
import { AuthController } from '../controllers/AuthController'

const controller = new AuthController()

export const authRouter = Router()

authRouter.post('/login', controller.login)

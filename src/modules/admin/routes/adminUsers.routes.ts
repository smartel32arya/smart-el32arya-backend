import { Router } from 'express'
import { AdminUserController } from '../controllers/AdminUserController'
import { requireSuperAdmin } from '../../../middleware/requireSuperAdmin'

const controller = new AdminUserController()

export const adminUsersRouter = Router()

adminUsersRouter.get('/',      controller.listUsers)
adminUsersRouter.post('/',     requireSuperAdmin, controller.createUser)
adminUsersRouter.put('/:id',   requireSuperAdmin, controller.updateUser)
adminUsersRouter.delete('/:id', requireSuperAdmin, controller.deleteUser)

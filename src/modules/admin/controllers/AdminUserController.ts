import { Response } from 'express'
import { asyncHandler } from '../../../middleware/asyncHandler'
import { UserService } from '../../users/services/UserService'
import { createUserSchema, updateUserSchema } from '../validators/adminUsers.schemas'
import { AppError } from '../../../errors/AppError'
import { AuthRequest } from '../../../types/express'

const service = new UserService()

export class AdminUserController {
  listUsers = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const users = await service.listUsers()
    res.json(users)
  })

  createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message)

    const user = await service.createUser(parsed.data)
    res.status(201).json(user)
  })

  updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message)

    const user = await service.updateUser(req.params.id, parsed.data)
    res.json(user)
  })

  deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    await service.deleteUser(req.params.id, req.user!.id)
    res.json({ message: 'تم حذف المستخدم بنجاح' })
  })
}

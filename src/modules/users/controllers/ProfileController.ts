import { Request, Response } from 'express'
import { asyncHandler } from '../../../middleware/asyncHandler'
import { ProfileService } from '../services/ProfileService'
import { updateProfileSchema } from '../validators/users.schemas'
import { AppError } from '../../../errors/AppError'
import { AuthRequest } from '../../../types/express'

const service = new ProfileService()

export class ProfileController {
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    res.json(await service.getProfile(authReq.user!.id))
  })

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const parsed = updateProfileSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message)
    res.json(await service.updateProfile(authReq.user!.id, parsed.data))
  })
}

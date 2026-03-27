import { Request, Response } from 'express'
import { asyncHandler } from '../../../middleware/asyncHandler'
import { AuthService } from '../services/AuthService'
import { loginSchema } from '../validators/auth.schemas'
import { AppError } from '../../../errors/AppError'

const service = new AuthService()

export class AuthController {
  login = asyncHandler(async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message)

    const { username, password } = parsed.data
    const result = await service.login(username, password)
    res.json(result)
  })
}

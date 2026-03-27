import { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { AuthRequest, JwtPayload } from '../types/express'
import UserModel from '../models/User'

export const authenticate: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'رأس التفويض مفقود أو غير صالح' })
    return
  }

  const token = authHeader.split(' ')[1]

  let payload: JwtPayload
  try {
    payload = jwt.verify(token, config.jwtSecret) as JwtPayload
  } catch {
    res.status(401).json({ message: 'الرمز غير صالح أو منتهي الصلاحية' })
    return
  }

  // Check account expiry on every request
  const user = await UserModel.findById(payload.id).lean()
  if (!user) {
    res.status(401).json({ message: 'المستخدم غير موجود' })
    return
  }

  // Check account is active and not expired
  if (!user.active) {
    res.status(403).json({ message: 'الحساب غير نشط' })
    return
  }

  if (user.role !== 'super_admin') {
    const expired = !user.expiresAt || new Date(user.expiresAt) < new Date()
    if (expired) {
      res.status(403).json({ message: 'انتهت صلاحية الحساب' })
      return
    }
  }

  const authReq = req as AuthRequest
  authReq.user = payload
  next()
}

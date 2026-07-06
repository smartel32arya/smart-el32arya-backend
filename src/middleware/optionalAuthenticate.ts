import { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { AuthRequest, JwtPayload } from '../types/express'
import UserModel from '../models/User'

export const optionalAuthenticate: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.split(' ')[1]

  let payload: JwtPayload
  try {
    payload = jwt.verify(token, config.jwtSecret) as JwtPayload
  } catch {
    return next()
  }

  const user = await UserModel.findById(payload.id).lean()
  if (!user) {
    return next()
  }

  if (!user.active) {
    return next()
  }

  if (user.role !== 'super_admin') {
    const expired = !user.expiresAt || new Date(user.expiresAt) < new Date()
    if (expired) {
      return next()
    }
  }

  const authReq = req as AuthRequest
  authReq.user = payload
  next()
}

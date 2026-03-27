import { Request } from 'express'

export interface JwtPayload {
  id: string            // MongoDB ObjectId as string
  username?: string
  role: 'super_admin' | 'property_admin'
  name: string
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

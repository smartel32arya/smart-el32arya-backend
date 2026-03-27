import { Request, Response, NextFunction, RequestHandler } from 'express'
import { AuthRequest } from '../types/express'

export const requireSuperAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest
  if (authReq.user?.role !== 'super_admin') {
    res.status(403).json({ message: 'غير مصرح: يلزم دور المشرف الأعلى' })
    return
  }
  next()
}

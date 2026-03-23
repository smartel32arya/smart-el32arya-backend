import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types/express'

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ message: 'غير مصرح: يلزم دور المشرف الأعلى' })
    return
  }
  next()
}

import { Request, Response, NextFunction, RequestHandler } from 'express'
import { AuthRequest } from '../types/express'
import PropertyModel from '../models/Property'

declare module 'express' {
  interface Request {
    property?: Record<string, unknown>
  }
}

/**
 * Allows access only if the authenticated user is a super_admin
 * OR the property was added by the authenticated user.
 * Attaches the fetched property to `req.property` to avoid a second DB query in the controller.
 */
export const requirePropertyOwnership: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as AuthRequest
  const user = authReq.user!

  const property = await PropertyModel.findById(req.params.id).lean()

  if (!property) {
    res.status(404).json({ message: 'العقار غير موجود' })
    return
  }

  if (user.role !== 'super_admin') {
    if ((property as unknown as { addedBy: { toString(): string } }).addedBy?.toString() !== user.id) {
      res.status(403).json({ message: 'غير مصرح: هذا العقار لم يتم إضافته بواسطتك' })
      return
    }
  }

  req.property = property as unknown as Record<string, unknown>
  next()
}

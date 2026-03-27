import { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[ERROR] ${req.method} ${req.url}`, err)
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({ message: err.message })
    return
  }
  res.status(500).json({ message: 'حدث خطأ داخلي في الخادم' })
}

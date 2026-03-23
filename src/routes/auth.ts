import { Request, Response } from 'express'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User'
import { JWT_SECRET } from '../config'
import { authenticate } from '../middleware/authenticate'
import { AuthRequest } from '../types/express'

export const authRouter = Router()

// POST /login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body

  const user = await User.findOne({ username })
  if (!user) {
    res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' })
    return
  }

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' })
    return
  }

  if (user.active === false) {
    res.status(403).json({ message: 'الحساب غير نشط' })
    return
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token, user: user.toJSON() })
})

// GET /me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ id: req.user!.id })
  if (!user) {
    res.status(401).json({ message: 'المستخدم غير موجود' })
    return
  }
  res.json(user.toJSON())
})

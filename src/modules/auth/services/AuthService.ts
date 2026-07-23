import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import UserModel from '../../../models/User'
import { AppError } from '../../../errors/AppError'
import { config } from '../../../config'
import { IUser } from '../../../types/user.types'

type SafeUser = Omit<IUser, 'password'>

function stripPassword(user: IUser): SafeUser {
  const { password: _pw, ...safe } = user
  return safe
}

function cleanPhone(p: string): string {
  let cleaned = p.replace(/[\s\-\(\)]/g, '')
  if (cleaned.startsWith('+2')) cleaned = cleaned.slice(2)
  else if (cleaned.startsWith('20') && cleaned.length === 12) cleaned = cleaned.slice(1)
  return cleaned
}

export class AuthService {
  async login(phone: string, password: string): Promise<{ token: string; user: SafeUser }> {
    const cleaned = cleanPhone(phone)
    const userDoc = await UserModel.findOne({
      $or: [{ phone }, { phone: cleaned }, { phone: `+2${cleaned}` }, { phone: `20${cleaned}` }]
    }).lean()
    const user = userDoc as unknown as IUser | null
    if (!user) throw new AppError(401, 'رقم الهاتف أو كلمة المرور غير صحيحة')

    const match = await bcrypt.compare(password, user.password)
    if (!match) throw new AppError(401, 'رقم الهاتف أو كلمة المرور غير صحيحة')

    if (user.active === false) throw new AppError(403, 'الحساب غير نشط')

    if (user.role !== 'super_admin') {
      const expired = !user.expiresAt || new Date(user.expiresAt) < new Date()
      if (expired) throw new AppError(403, 'انتهت صلاحية الحساب')
    }

    const token = jwt.sign(
      { id: String(user._id), phone: user.phone, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: '7d' }
    )

    return { token, user: stripPassword(user) }
  }

  async register(data: { name: string; password: string; phone: string }): Promise<SafeUser> {
    const { name, password, phone } = data
    const cleaned = cleanPhone(phone)

    const existing = await UserModel.findOne({
      $or: [{ phone }, { phone: cleaned }, { phone: `+2${cleaned}` }, { phone: `20${cleaned}` }]
    }).lean()
    if (existing) {
      throw new AppError(409, 'رقم الهاتف مستخدم بالفعل')
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const user = await UserModel.create({
      name,
      password: hashedPassword,
      phone: cleaned,
      role: 'property_admin',
      active: true,
      expiresAt
    })

    return stripPassword(user.toObject() as unknown as IUser)
  }
}

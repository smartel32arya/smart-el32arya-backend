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

export class AuthService {
  async login(username: string, password: string): Promise<{ token: string; user: SafeUser }> {
    const doc = await UserModel.findOne({ username }).lean()
    const user = doc as unknown as IUser | null
    if (!user) throw new AppError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة')

    const match = await bcrypt.compare(password, user.password)
    if (!match) throw new AppError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة')

    if (user.active === false) throw new AppError(403, 'الحساب غير نشط')

    if (user.role !== 'super_admin') {
      const expired = !user.expiresAt || new Date(user.expiresAt) < new Date()
      if (expired) throw new AppError(403, 'انتهت صلاحية الحساب')
    }

    const token = jwt.sign(
      { id: String(user._id), username: user.username, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: '7d' }
    )

    return { token, user: stripPassword(user) }
  }

  async register(data: any): Promise<SafeUser> {
    const { name, username, password, phone } = data

    const existing = await UserModel.findOne({ username }).lean()
    if (existing) {
      throw new AppError(409, 'اسم المستخدم مستخدم بالفعل')
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const user = await UserModel.create({
      name,
      username,
      password: hashedPassword,
      phone,
      role: 'property_admin',
      active: true,
      expiresAt
    })

    return stripPassword(user.toObject() as unknown as IUser)
  }
}

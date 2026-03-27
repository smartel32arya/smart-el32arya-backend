import bcrypt from 'bcryptjs'
import UserModel from '../../../models/User'
import { AppError } from '../../../errors/AppError'
import { IUser } from '../../../types/user.types'

type SafeUser = Omit<IUser, 'password'>

function stripPassword(user: IUser): SafeUser {
  const { password: _pw, ...safe } = user
  return safe
}

export class ProfileService {
  async getProfile(userId: string): Promise<SafeUser> {
    const doc = await UserModel.findById(userId).lean()
    if (!doc) throw new AppError(401, 'المستخدم غير موجود')
    return stripPassword(doc as unknown as IUser)
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; phone?: string; currentPassword?: string; newPassword?: string }
  ): Promise<SafeUser> {
    const doc = await UserModel.findById(userId)
    if (!doc) throw new AppError(401, 'المستخدم غير موجود')

    if (dto.newPassword && dto.currentPassword) {
      const match = await bcrypt.compare(dto.currentPassword, (doc as unknown as IUser).password)
      if (!match) throw new AppError(400, 'كلمة المرور الحالية غير صحيحة')
      doc.password = await bcrypt.hash(dto.newPassword, 10)
    }

    if (dto.name)  doc.name  = dto.name
    if (dto.phone) doc.phone = dto.phone

    try {
      await doc.save()
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        throw new AppError(409, 'رقم الهاتف مستخدم بالفعل')
      }
      throw err
    }

    return stripPassword(doc.toObject() as unknown as IUser)
  }
}

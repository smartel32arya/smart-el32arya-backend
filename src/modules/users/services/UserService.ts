import bcrypt from 'bcryptjs'
import UserModel from '../../../models/User'
import { AppError } from '../../../errors/AppError'
import { IUser, CreateUserDto, UpdateUserDto } from '../../../types/user.types'

type SafeUser = Omit<IUser, 'password'>

function stripPassword(user: IUser): SafeUser {
  const { password: _pw, ...safe } = user
  return safe
}

export class UserService {
  async listUsers(): Promise<SafeUser[]> {
    const docs = await UserModel.find().lean()
    return (docs as unknown as IUser[]).map(stripPassword)
  }

  async createUser(dto: CreateUserDto): Promise<SafeUser> {

    if (dto.username) {
      const existingByUsername = await UserModel.findOne({ username: dto.username }).lean()
      if (existingByUsername) throw new AppError(409, 'اسم المستخدم مستخدم بالفعل')
    }

    // super_admin never expires — ignore any expiresAt passed in
    const expiresAt = dto.role === 'super_admin' ? null : (dto.expiresAt ?? null)

    const hashedPassword = await bcrypt.hash(dto.password, 10)
    const doc = new UserModel({ ...dto, password: hashedPassword, expiresAt })

    try {
      await doc.save()
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {}
        if (keyValue.username) throw new AppError(409, 'اسم المستخدم مستخدم بالفعل')
        throw new AppError(409, 'البيانات مستخدمة بالفعل')
      }
      throw err
    }

    return stripPassword(doc.toObject() as unknown as IUser)
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<SafeUser> {

    if (dto.username) {
      const existing = await UserModel.findOne({ username: dto.username }).lean()
      const existingUser = existing as unknown as IUser | null
      if (existingUser && existingUser._id.toString() !== id) throw new AppError(409, 'اسم المستخدم مستخدم بالفعل')
    }

    const doc = await UserModel.findById(id)
    if (!doc) throw new AppError(404, 'المستخدم غير موجود')

    const updates: UpdateUserDto = { ...dto }

    if (dto.password) {
      updates.password = await bcrypt.hash(dto.password, 10)
    }

    // super_admin can never have an expiry — strip it if someone tries to set one
    const effectiveRole = (dto.role ?? doc.role) as IUser['role']
    if (effectiveRole === 'super_admin') {
      updates.expiresAt = null
    }

    Object.assign(doc, updates)

    try {
      await doc.save()
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {}
        if (keyValue.username) throw new AppError(409, 'اسم المستخدم مستخدم بالفعل')
        throw new AppError(409, 'البيانات مستخدمة بالفعل')
      }
      throw err
    }

    return stripPassword(doc.toObject() as unknown as IUser)
  }

  async deleteUser(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) throw new AppError(403, 'لا يمكنك حذف حسابك الخاص')
    const doc = await UserModel.findByIdAndDelete(id)
    if (!doc) throw new AppError(404, 'المستخدم غير موجود')
  }
}

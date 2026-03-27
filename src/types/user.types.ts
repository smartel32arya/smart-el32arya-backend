export interface IUser {
  _id: string
  name: string
  username: string
  password: string
  phone: string
  role: 'super_admin' | 'property_admin'
  active: boolean
  expiresAt: Date | null
  createdAt: string
}

export type CreateUserDto = Pick<IUser, 'name' | 'password' | 'role' | 'phone'> & {
  username?: string
  active?: boolean
  expiresAt?: Date | null
}
export type UpdateUserDto = Partial<Omit<IUser, '_id' | 'createdAt'>>

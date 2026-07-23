import { Schema, model, Document } from 'mongoose'
import { IUser } from '../types/user.types'

export type { IUser }

const UserSchema = new Schema<IUser & Document>(
  {
    name: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    role: {
      type: String,
      enum: ['super_admin', 'property_admin'],
      required: true,
    },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    activePropertiesLimit: { type: Number, default: 3 },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.password
        return ret
      },
    },
    toObject: { virtuals: true },
  }
)

const User = model<IUser & Document>('User', UserSchema)

export default User

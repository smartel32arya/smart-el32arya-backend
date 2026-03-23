import { Schema, model, Document } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

export interface IUser {
  id: string
  name: string
  username: string
  email: string
  password: string
  role: 'super_admin' | 'property_admin'
  active: boolean
  createdAt: string
}

const UserSchema = new Schema<IUser & Document>(
  {
    id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: false },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'property_admin'],
      required: true,
    },
    active: { type: Boolean, default: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.password
        return ret
      },
    },
  }
)

const User = model<IUser & Document>('User', UserSchema)

export default User

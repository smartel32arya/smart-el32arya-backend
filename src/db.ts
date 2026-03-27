import mongoose from 'mongoose'
import { config } from './config'

let isConnected = false

export async function connectDB(): Promise<void> {
  if (isConnected) return

  try {
    await mongoose.connect(config.mongodbUri)
    isConnected = true
    console.log('[DB] MongoDB connected')

    // Reset flag on unexpected disconnection so the next request reconnects
    mongoose.connection.once('disconnected', () => {
      isConnected = false
      console.warn('[DB] MongoDB disconnected')
    })
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error)
    process.exit(1)
  }
}

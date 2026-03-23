import mongoose from 'mongoose';
import { MONGODB_URI } from './config';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;
  try {
    console.log('[DB] Connecting to MongoDB...');
    console.log('[DB] URI defined:', !!process.env.MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('[DB] MongoDB connected successfully');
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error);
    process.exit(1);
  }
}

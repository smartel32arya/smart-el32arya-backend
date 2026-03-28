import mongoose from 'mongoose'
import { config } from '../config'
import PropertyModel from '../models/Property'

async function run() {
  try {
    console.log('Connecting to database...')
    await mongoose.connect(config.mongodbUri)
    console.log('Connected.')

    const result = await PropertyModel.updateMany(
      { listingType: { $exists: false } },
      { $set: { listingType: 'sale' } }
    )

    console.log(`Migration complete. Documents updated: ${result.modifiedCount}`)
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

run()

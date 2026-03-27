import mongoose from 'mongoose'
import { config } from '../config'
import PropertyModel from '../models/Property'

async function run() {
  try {
    console.log('Connecting to database...')
    await mongoose.connect(config.mongodbUri)
    console.log('Connected.')

    const ownerId = new mongoose.Types.ObjectId('69c615861a55a3e4a1d318b5')
    
    // We filter by ownerId and the "[Test]" prefix to make sure we don't accidentally delete real data
    const query = { 
      addedBy: ownerId,
      title: { $regex: /^\[Test\]/ } 
    }

    const propertiesToDelete = await PropertyModel.countDocuments(query)
    
    if (propertiesToDelete === 0) {
      console.log('No test properties found to delete.')
    } else {
      const result = await PropertyModel.deleteMany(query)
      console.log(`Successfully deleted ${result.deletedCount} test properties.`)
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Error deleting properties:', error)
    process.exit(1)
  }
}

run()

import mongoose from 'mongoose'
import { config } from '../config'
import PropertyModel from '../models/Property'
import { formatPrice } from '../utils/formatPrice'

async function run() {
  try {
    console.log('Connecting to database...')
    await mongoose.connect(config.mongodbUri)
    console.log('Connected.')

    const ownerId = new mongoose.Types.ObjectId('69c615861a55a3e4a1d318b5')
    const properties = []

    for (let i = 1; i <= 10; i++) {
      const price = 1500000 + (i * 20000)
      properties.push({
        title: `[Test] شقة فاخرة رقم ${i}`,
        description: `شقة تجريبية للإيجار أو البيع رقم ${i}، توفر إطلالة مميزة ومرافق متكاملة.`,
        price,
        priceFormatted: formatPrice(price),
        location: 'المنيا الجديدة',
        neighborhood: 'حي الزهراء', 
        type: 'شقة',
        bedrooms: 3,
        bathrooms: 2,
        area: 120 + i * 5,
        image: 'https://via.placeholder.com/800x600?text=Property',
        images: ['https://via.placeholder.com/800x600?text=Property'],
        video: null,
        amenities: ['أمن', 'جراج', 'مصعد'],
        featured: i % 3 === 0, // make every 3rd property featured
        active: true,
        addedBy: ownerId,
        createdAt: new Date().toISOString()
      })
    }

    const result = await PropertyModel.insertMany(properties)
    console.log(`Successfully added ${result.length} test properties by owner: ${ownerId.toString()}`)
    
    process.exit(0)
  } catch (error) {
    console.error('Error adding properties:', error)
    process.exit(1)
  }
}

run()

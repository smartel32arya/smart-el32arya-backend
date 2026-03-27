import fc from 'fast-check'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Property from '../models/Property'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Property.deleteMany({})
})

// Helper: minimal valid property object
function makeProperty(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Property',
    description: 'A test description',
    price: 500000,
    location: 'المنيا الجديدة',
    neighborhood: 'حي الزهراء',
    type: 'شقة',
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    images: ['img1.jpg'],
    ...overrides,
  }
}


// Feature: smart-realestate-backend, Property 20: image auto-set from images[0]
describe('Property 20: image auto-set from images[0]', () => {
  test('fast-check: image === images[0] after save for any non-empty images array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        async (images) => {
          await Property.deleteMany({})
          const prop = await new Property(makeProperty({ images })).save()
          expect(prop.image).toBe(images[0])
        }
      ),
      { numRuns: 100 }
    )
  })
})



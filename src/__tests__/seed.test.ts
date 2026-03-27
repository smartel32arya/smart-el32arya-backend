import fc from 'fast-check'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Property from '../models/Property'
import User from '../models/User'
import { seedDatabase } from '../seed'

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
  await User.deleteMany({})
})

// Unit examples: after running seed, counts and roles are correct
describe('Seed Script — unit examples', () => {
  test('inserts exactly 6 properties', async () => {
    await seedDatabase()
    const count = await Property.countDocuments()
    expect(count).toBe(6)
  })

  test('creates a super_admin user', async () => {
    await seedDatabase()
    const superAdmin = await User.findOne({ role: 'super_admin' })
    expect(superAdmin).not.toBeNull()
    expect(superAdmin!.username).toBe('admin')
  })
})

// Feature: smart-realestate-backend, Property 22: Seed clears existing data
describe('Property 22: Seed clears existing data', () => {
  /**
   * Validates: Requirements 13.3
   *
   * For any pre-existing data in the database, running seedDatabase() should
   * result in the database containing exactly the seeded records (no old records remain).
   */
  test('fast-check: seed always results in exactly the seeded records regardless of pre-existing data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
        async (extraProperties, extraUsers) => {
          // Insert pre-existing records
          const extraProps = Array.from({ length: extraProperties }, (_, i) => ({
            title: `Old Property ${i}`,
            description: 'Old description',
            price: 100000 + i,
            priceFormatted: '١٠٠,٠٠٠ ج.م',
            location: 'مكان قديم',
            neighborhood: 'حي الزهراء' as const,
            type: 'شقة' as const,
            bedrooms: 2,
            bathrooms: 1,
            area: 80,
            images: ['old.jpg'],
            image: 'old.jpg',
            amenities: [],
            featured: false,
            active: true,
            createdAt: new Date().toISOString(),
          }))
          if (extraProps.length > 0) {
            await Property.insertMany(extraProps)
          }

          const extraUserDocs = Array.from({ length: extraUsers }, (_, i) => ({
            name: `Old User ${i}`,
            username: `olduser${i}_user`,
            password: 'hashed',
            role: 'property_admin' as const,
            active: true,
          }))
          if (extraUserDocs.length > 0) {
            await User.insertMany(extraUserDocs)
          }

          // Run seed — should clear everything and insert only seeded records
          await seedDatabase()

          const propertyCount = await Property.countDocuments()
          const userCount = await User.countDocuments()

          expect(propertyCount).toBe(6)
          expect(userCount).toBe(1)

          // Clean up for next iteration
          await Property.deleteMany({})
          await User.deleteMany({})
        }
      ),
      { numRuns: 100 }
    )
  })
})

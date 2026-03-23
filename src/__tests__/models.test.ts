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

const VALID_NEIGHBORHOODS = ['حي الزهراء', 'الحي الثامن', 'الحي الأول', 'المحور المركزي']
const VALID_TYPES = ['شقة', 'فيلا', 'دوبلكس', 'تجاري']

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

// Feature: smart-realestate-backend, Property 21: enum validation for neighborhood and type
describe('Property 21: enum validation for neighborhood and type', () => {
  test('saving a property with invalid neighborhood throws validation error', async () => {
    const prop = new Property(makeProperty({ neighborhood: 'حي غير موجود' }))
    await expect(prop.save()).rejects.toThrow()
  })

  test('saving a property with invalid type throws validation error', async () => {
    const prop = new Property(makeProperty({ type: 'نوع غير موجود' }))
    await expect(prop.save()).rejects.toThrow()
  })

  test('fast-check: any string not in allowed neighborhood enum causes save to throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => !VALID_NEIGHBORHOODS.includes(s) && s.length > 0),
        async (invalidNeighborhood) => {
          const prop = new Property(makeProperty({ neighborhood: invalidNeighborhood }))
          await expect(prop.save()).rejects.toThrow()
        }
      ),
      { numRuns: 50 }
    )
  })

  test('fast-check: any string not in allowed type enum causes save to throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => !VALID_TYPES.includes(s) && s.length > 0),
        async (invalidType) => {
          const prop = new Property(makeProperty({ type: invalidType }))
          await expect(prop.save()).rejects.toThrow()
        }
      ),
      { numRuns: 50 }
    )
  })
})

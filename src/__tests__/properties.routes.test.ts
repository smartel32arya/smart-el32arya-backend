import express from 'express'
import request from 'supertest'
import fc from 'fast-check'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { propertiesRouter } from '../routes/properties'
import Property from '../models/Property'

// Minimal test app — no connectDB, no listen
const app = express()
app.use(express.json())
app.use('/api/properties', propertiesRouter)

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

// Helper to build a minimal valid property object
function makeProperty(overrides: Partial<{
  title: string
  description: string
  price: number
  location: string
  neighborhood: string
  type: string
  bedrooms: number
  bathrooms: number
  area: number
  images: string[]
  featured: boolean
  active: boolean
}> = {}) {
  return {
    title: 'Test Property',
    description: 'A test property',
    price: 1_000_000,
    location: 'المنيا الجديدة',
    neighborhood: 'حي الزهراء',
    type: 'شقة',
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    images: ['img1.jpg'],
    featured: false,
    active: true,
    ...overrides,
  }
}

const NEIGHBORHOODS = ['حي الزهراء', 'الحي الثامن', 'الحي الأول', 'المحور المركزي'] as const
const TYPES = ['شقة', 'فيلا', 'دوبلكس', 'تجاري'] as const

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 3: Active properties filter
// ─────────────────────────────────────────────────────────────────────────────
test('GET /api/properties returns only active properties', async () => {
  await Property.create([
    makeProperty({ active: true, title: 'Active 1' }),
    makeProperty({ active: true, title: 'Active 2' }),
    makeProperty({ active: false, title: 'Inactive 1' }),
  ])

  const res = await request(app).get('/api/properties')
  expect(res.status).toBe(200)
  expect(res.body.data).toHaveLength(2)
  res.body.data.forEach((p: { active: boolean }) => {
    expect(p.active).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 4: Field filtering
// ─────────────────────────────────────────────────────────────────────────────
test('Property 4: neighborhood/type filter — all returned properties match the filter', async () => {
  // Seed one property per neighborhood/type combo
  const seeds = []
  for (const n of NEIGHBORHOODS) {
    for (const t of TYPES) {
      seeds.push(makeProperty({ neighborhood: n, type: t, active: true }))
    }
  }
  await Property.create(seeds)

  await fc.assert(
    fc.asyncProperty(
      fc.record({
        neighborhood: fc.constantFrom(...NEIGHBORHOODS),
        type: fc.constantFrom(...TYPES),
      }),
      async ({ neighborhood, type }) => {
        const res = await request(app)
          .get('/api/properties')
          .query({ neighborhood, type })
        expect(res.status).toBe(200)
        for (const p of res.body.data) {
          expect(p.neighborhood).toBe(neighborhood)
          expect(p.type).toBe(type)
        }
      }
    ),
    { numRuns: 50 }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 5: Price range filter
// ─────────────────────────────────────────────────────────────────────────────
test('Property 5: priceRange filter — all returned properties are within range', async () => {
  // Seed properties at various price points
  const prices = [500_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000]
  await Property.create(prices.map(price => makeProperty({ price, active: true })))

  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 4_000_000 }),
      fc.integer({ min: 0, max: 4_000_000 }),
      async (a, b) => {
        const min = Math.min(a, b)
        const max = Math.max(a, b)
        const res = await request(app)
          .get('/api/properties')
          .query({ priceRange: `${min}-${max}` })
        expect(res.status).toBe(200)
        for (const p of res.body.data) {
          expect(p.price).toBeGreaterThanOrEqual(min)
          expect(p.price).toBeLessThanOrEqual(max)
        }
      }
    ),
    { numRuns: 50 }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 6: Sort order
// ─────────────────────────────────────────────────────────────────────────────
test('Property 6: sort order — consecutive pairs satisfy sort invariant', async () => {
  const prices = [300_000, 700_000, 1_200_000, 2_500_000, 4_000_000]
  const areas = [80, 120, 150, 200, 250]
  await Property.create(
    prices.map((price, i) => makeProperty({ price, area: areas[i], active: true }))
  )

  const SORT_PARAMS = ['newest', 'price-asc', 'price-desc', 'area-desc'] as const

  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...SORT_PARAMS),
      async (sort) => {
        const res = await request(app)
          .get('/api/properties')
          .query({ sort, pageSize: 100 })
        expect(res.status).toBe(200)
        const data: Array<{ price: number; area: number; createdAt: string }> = res.body.data
        for (let i = 0; i < data.length - 1; i++) {
          if (sort === 'price-asc') {
            expect(data[i].price).toBeLessThanOrEqual(data[i + 1].price)
          } else if (sort === 'price-desc') {
            expect(data[i].price).toBeGreaterThanOrEqual(data[i + 1].price)
          } else if (sort === 'area-desc') {
            expect(data[i].area).toBeGreaterThanOrEqual(data[i + 1].area)
          } else if (sort === 'newest') {
            expect(data[i].createdAt >= data[i + 1].createdAt).toBe(true)
          }
        }
      }
    ),
    { numRuns: 50 }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 7: Pagination shape
// ─────────────────────────────────────────────────────────────────────────────
test('Property 7: pagination response always has correct shape and math', async () => {
  // Seed 20 active properties
  await Property.create(
    Array.from({ length: 20 }, (_, i) => makeProperty({ title: `Prop ${i}`, active: true }))
  )

  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 10 }),
      async (page, pageSize) => {
        const res = await request(app)
          .get('/api/properties')
          .query({ page, pageSize })
        expect(res.status).toBe(200)
        const body = res.body
        expect(body).toHaveProperty('data')
        expect(body).toHaveProperty('total')
        expect(body).toHaveProperty('page')
        expect(body).toHaveProperty('pageSize')
        expect(body).toHaveProperty('totalPages')
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.data.length).toBeLessThanOrEqual(body.pageSize)
        expect(body.totalPages).toBe(Math.ceil(body.total / body.pageSize))
      }
    ),
    { numRuns: 50 }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 8: Featured filter
// ─────────────────────────────────────────────────────────────────────────────
test('Property 8: GET /api/properties/featured returns only featured=true AND active=true', async () => {
  await Property.create([
    makeProperty({ featured: true, active: true, title: 'Featured Active' }),
    makeProperty({ featured: true, active: false, title: 'Featured Inactive' }),
    makeProperty({ featured: false, active: true, title: 'Not Featured Active' }),
    makeProperty({ featured: false, active: false, title: 'Not Featured Inactive' }),
  ])

  const res = await request(app).get('/api/properties/featured')
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
  res.body.forEach((p: { featured: boolean; active: boolean }) => {
    expect(p.featured).toBe(true)
    expect(p.active).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 9: Featured limit
// ─────────────────────────────────────────────────────────────────────────────
test('Property 9: GET /api/properties/featured?limit=N returns at most N results', async () => {
  // Seed 10 featured active properties
  await Property.create(
    Array.from({ length: 10 }, (_, i) =>
      makeProperty({ featured: true, active: true, title: `Featured ${i}` })
    )
  )

  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 15 }),
      async (limit) => {
        const res = await request(app)
          .get('/api/properties/featured')
          .query({ limit })
        expect(res.status).toBe(200)
        expect(Array.isArray(res.body)).toBe(true)
        expect(res.body.length).toBeLessThanOrEqual(limit)
      }
    ),
    { numRuns: 50 }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 10: Single property by ID
// ─────────────────────────────────────────────────────────────────────────────
test('Property 10: GET /api/properties/:id returns property regardless of active status', async () => {
  const active = await Property.create(makeProperty({ active: true }))
  const inactive = await Property.create(makeProperty({ active: false }))

  const resActive = await request(app).get(`/api/properties/${active.id}`)
  expect(resActive.status).toBe(200)
  expect(resActive.body.id).toBe(active.id)

  const resInactive = await request(app).get(`/api/properties/${inactive.id}`)
  expect(resInactive.status).toBe(200)
  expect(resInactive.body.id).toBe(inactive.id)
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 11: 404 for missing property
// ─────────────────────────────────────────────────────────────────────────────
test('Property 11: GET /api/properties/:id returns 404 for non-existent ID', async () => {
  const res = await request(app).get('/api/properties/nonexistent-id-that-does-not-exist')
  expect(res.status).toBe(404)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit examples
// ─────────────────────────────────────────────────────────────────────────────
test('featured endpoint returns array (not pagination object)', async () => {
  const res = await request(app).get('/api/properties/featured')
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
  expect(res.body).not.toHaveProperty('data')
  expect(res.body).not.toHaveProperty('total')
})

test('featured endpoint default limit is 6', async () => {
  // Seed 10 featured active properties
  await Property.create(
    Array.from({ length: 10 }, (_, i) =>
      makeProperty({ featured: true, active: true, title: `Featured ${i}` })
    )
  )

  const res = await request(app).get('/api/properties/featured')
  expect(res.status).toBe(200)
  expect(res.body.length).toBeLessThanOrEqual(6)
})

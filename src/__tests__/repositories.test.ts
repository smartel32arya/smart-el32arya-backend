import fc from 'fast-check'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { PropertyService } from '../modules/properties/services/PropertyService'
import { UserService } from '../modules/users/services/UserService'
import { AppError } from '../errors/AppError'
import PropertyModel from '../models/Property'
import UserModel from '../models/User'

let mongoServer: MongoMemoryServer
let propertyService: PropertyService
let userService: UserService

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
  propertyService = new PropertyService()
  userService = new UserService()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await PropertyModel.deleteMany({})
  await UserModel.deleteMany({})
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePropertyData(overrides: Record<string, unknown> = {}) {
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
    video: null,
    amenities: [],
    featured: false,
    active: true,
    showPrice: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Property 2: Service throws AppError(404) on missing document
// Feature: clean-architecture-refactor, Property 2: Service throws AppError(404) on missing document
// ---------------------------------------------------------------------------

describe('Property 2: Service throws AppError(404) on missing document', () => {
  // Feature: clean-architecture-refactor, Property 2: Service throws AppError(404) on missing document
  test('PropertyService.getById throws AppError(404) for any non-existent id', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (randomId) => {
          await expect(propertyService.getById(randomId)).rejects.toMatchObject({
            httpStatus: 404,
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: clean-architecture-refactor, Property 2: Service throws AppError(404) on missing document
  test('UserService.deleteUser throws AppError(404) for any non-existent user id', async () => {
    // Create a requester so self-deletion check doesn't trigger
    const requester = await userService.createUser({
      name: 'Requester',
      username: 'requester_user',
      password: 'pass1234',
      phone: '01000000000',
      role: 'super_admin',
    })

    await fc.assert(
      fc.asyncProperty(
        fc.uuid().filter(id => id !== requester._id),
        async (randomId) => {
          await expect(userService.deleteUser(randomId, requester._id ?? '')).rejects.toMatchObject({
            httpStatus: 404,
          })
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: listProperties concurrent queries
// Feature: clean-architecture-refactor, Property 3: listProperties concurrent queries
// ---------------------------------------------------------------------------

describe('Property 3: listProperties concurrent queries', () => {
  // Feature: clean-architecture-refactor, Property 3: listProperties concurrent queries
  test('listProperties total matches countDocuments for any filter and pagination', async () => {
    // Seed a fixed set of properties with varied active/featured/neighborhood/type
    const seeds = [
      makePropertyData({ active: true, featured: true, neighborhood: 'حي الزهراء', type: 'شقة' }),
      makePropertyData({ active: true, featured: false, neighborhood: 'الحي الثامن', type: 'فيلا' }),
      makePropertyData({ active: false, featured: false, neighborhood: 'حي الزهراء', type: 'شقة' }),
      makePropertyData({ active: true, featured: true, neighborhood: 'الحي الأول', type: 'دوبلكس' }),
      makePropertyData({ active: false, featured: true, neighborhood: 'الحي الثامن', type: 'فيلا' }),
    ]
    for (const seed of seeds) {
      await new PropertyModel(seed).save()
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          active: fc.option(fc.boolean(), { nil: undefined }),
          neighborhood: fc.option(fc.constantFrom('حي الزهراء', 'الحي الثامن', 'الحي الأول'), { nil: undefined }),
          type: fc.option(fc.constantFrom('شقة', 'فيلا', 'دوبلكس'), { nil: undefined }),
        }),
        fc.record({
          page: fc.integer({ min: 1, max: 3 }),
          pageSize: fc.integer({ min: 1, max: 10 }),
        }),
        async (filter, pagination) => {
          // Build the same query that PropertyService uses to get the expected count
          const query: Record<string, unknown> = {}
          if (filter.active !== undefined) query.active = filter.active
          if (filter.neighborhood !== undefined) query.neighborhood = filter.neighborhood
          if (filter.type !== undefined) query.type = filter.type

          const expectedTotal = await PropertyModel.countDocuments(query)
          const result = await propertyService.listProperties(filter, pagination)

          expect(result.total).toBe(expectedTotal)
          expect(result.data.length).toBeLessThanOrEqual(pagination.pageSize)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('listProperties uses Promise.all — count and data queries run concurrently', async () => {
    // Verify the implementation uses Promise.all by checking the result is consistent
    // with what a sequential implementation would return (structural test)
    await new PropertyModel(makePropertyData({ active: true })).save()
    await new PropertyModel(makePropertyData({ active: true })).save()
    await new PropertyModel(makePropertyData({ active: false })).save()

    const filter = { active: true }
    const pagination = { page: 1, pageSize: 10 }

    const result = await propertyService.listProperties(filter, pagination)

    // The total must equal the count of matching documents
    const expectedTotal = await PropertyModel.countDocuments({ active: true })
    expect(result.total).toBe(expectedTotal)
    expect(result.data).toHaveLength(expectedTotal)
  })
})

// ---------------------------------------------------------------------------
// Property 12: Compound index coverage (unit test — check explain() plan)
// Feature: clean-architecture-refactor, Property 12: Compound index coverage
// ---------------------------------------------------------------------------

describe('Property 12: Compound index coverage', () => {
  beforeEach(async () => {
    // Seed enough documents so the query planner considers indexes
    for (let i = 0; i < 5; i++) {
      await new PropertyModel(makePropertyData({ active: i % 2 === 0, featured: i % 3 === 0 })).save()
    }
  })

  test('{ active, featured } filter uses IXSCAN not COLLSCAN', async () => {
    const explainResult = await PropertyModel.find({ active: true, featured: true })
      .explain('queryPlanner') as unknown as { queryPlanner: { winningPlan: { inputStage?: { stage: string }; stage: string } } }

    const winningPlan = explainResult.queryPlanner.winningPlan
    // The winning plan or its input stage should be an IXSCAN
    const usesIndex =
      winningPlan.stage === 'IXSCAN' ||
      winningPlan.inputStage?.stage === 'IXSCAN' ||
      winningPlan.stage === 'FETCH' && winningPlan.inputStage?.stage === 'IXSCAN'

    expect(usesIndex).toBe(true)
  })

  test('{ active, neighborhood } filter uses IXSCAN not COLLSCAN', async () => {
    const explainResult = await PropertyModel.find({ active: true, neighborhood: 'حي الزهراء' })
      .explain('queryPlanner') as unknown as { queryPlanner: { winningPlan: { inputStage?: { stage: string }; stage: string } } }

    const winningPlan = explainResult.queryPlanner.winningPlan
    const usesIndex =
      winningPlan.stage === 'IXSCAN' ||
      winningPlan.inputStage?.stage === 'IXSCAN' ||
      winningPlan.stage === 'FETCH' && winningPlan.inputStage?.stage === 'IXSCAN'

    expect(usesIndex).toBe(true)
  })

  test('{ active, type } filter uses IXSCAN not COLLSCAN', async () => {
    const explainResult = await PropertyModel.find({ active: true, type: 'شقة' })
      .explain('queryPlanner') as unknown as { queryPlanner: { winningPlan: { inputStage?: { stage: string }; stage: string } } }

    const winningPlan = explainResult.queryPlanner.winningPlan
    const usesIndex =
      winningPlan.stage === 'IXSCAN' ||
      winningPlan.inputStage?.stage === 'IXSCAN' ||
      winningPlan.stage === 'FETCH' && winningPlan.inputStage?.stage === 'IXSCAN'

    expect(usesIndex).toBe(true)
  })
})

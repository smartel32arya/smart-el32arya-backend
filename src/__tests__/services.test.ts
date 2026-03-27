import * as fc from 'fast-check'
import { PropertyService } from '../modules/properties/services/PropertyService'
import { UserService } from '../modules/users/services/UserService'
import { AppError } from '../errors/AppError'
import PropertyModel from '../models/Property'
import UserModel from '../models/User'

jest.mock('../models/Property')
jest.mock('../models/User')

const MockedPropertyModel = PropertyModel as jest.Mocked<typeof PropertyModel>
const MockedUserModel = UserModel as jest.Mocked<typeof UserModel>

describe('PropertyService — property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Feature: clean-architecture-refactor, Property 2: Service throws AppError(404) when Mongoose findOne returns null
  it('Property 2: throws AppError(404) when findOne/findOneAndDelete returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (id: string) => {
          // getById: findOne().lean() returns null
          ;(MockedPropertyModel.findOne as jest.Mock).mockReturnValue({
            lean: () => Promise.resolve(null),
          })

          const service = new PropertyService()

          const errGetById = await service.getById(id).catch((e: unknown) => e)
          expect(errGetById).toBeInstanceOf(AppError)
          expect((errGetById as AppError).httpStatus).toBe(404)

          // updateProperty: findOne() returns null (no .lean())
          ;(MockedPropertyModel.findOne as jest.Mock).mockResolvedValue(null)
          const errUpdate = await service.updateProperty(id, {}).catch((e: unknown) => e)
          expect(errUpdate).toBeInstanceOf(AppError)
          expect((errUpdate as AppError).httpStatus).toBe(404)

          // deleteProperty: findOneAndDelete returns null
          ;(MockedPropertyModel.findOneAndDelete as jest.Mock).mockResolvedValue(null)
          const errDelete = await service.deleteProperty(id).catch((e: unknown) => e)
          expect(errDelete).toBeInstanceOf(AppError)
          expect((errDelete as AppError).httpStatus).toBe(404)
        }
      ),
      { numRuns: 100 },
    )
  })

  // Feature: clean-architecture-refactor, Property 3: PropertyService.listProperties issues count and data queries concurrently
  it('Property 3: listProperties issues count and data queries concurrently via Promise.all', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (page: number) => {
          const pageSize = 10
          let findStarted = false
          let countStarted = false
          let findResolve!: (v: unknown[]) => void
          let countResolve!: (v: number) => void

          const findPromise = new Promise<unknown[]>((resolve) => {
            findResolve = resolve
          })
          const countPromise = new Promise<number>((resolve) => {
            countResolve = resolve
          })

          ;(MockedPropertyModel.find as jest.Mock).mockImplementation(() => ({
            sort: () => ({
              skip: () => ({
                limit: () => ({
                  lean: () => {
                    findStarted = true
                    return findPromise
                  },
                }),
              }),
            }),
          }))
          ;(MockedPropertyModel.countDocuments as jest.Mock).mockImplementation(() => {
            countStarted = true
            return countPromise
          })

          const service = new PropertyService()
          const resultPromise = service.listProperties({}, { page, pageSize })

          // Yield to the event loop so the async function runs up to Promise.all
          await Promise.resolve()

          // Both queries must be initiated before either resolves
          expect(findStarted).toBe(true)
          expect(countStarted).toBe(true)

          // Resolve both so the test can finish
          findResolve([])
          countResolve(0)

          await resultPromise
        }
      ),
      { numRuns: 100 },
    )
  })
})

describe('UserService — property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Feature: clean-architecture-refactor, Property 2: Service throws AppError(404) when Mongoose findOne returns null
  it('Property 2: throws AppError(404) when findOne/findOneAndDelete returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (id: string) => {
          // All findOne calls return null:
          // - duplicate username/username checks return null (no conflict)
          // - final findOne({ id }) returns null → triggers 404
          ;(MockedUserModel.findOne as jest.Mock).mockResolvedValue(null)

          const service = new UserService()

          const errUpdate = await service.updateUser(id, {}).catch((e: unknown) => e)
          expect(errUpdate).toBeInstanceOf(AppError)
          expect((errUpdate as AppError).httpStatus).toBe(404)

          // deleteUser: use a different requesterId to avoid the 403 self-deletion guard
          ;(MockedUserModel.findOneAndDelete as jest.Mock).mockResolvedValue(null)
          const errDelete = await service.deleteUser(id, id + '-other').catch((e: unknown) => e)
          expect(errDelete).toBeInstanceOf(AppError)
          expect((errDelete as AppError).httpStatus).toBe(404)
        }
      ),
      { numRuns: 100 },
    )
  })
})

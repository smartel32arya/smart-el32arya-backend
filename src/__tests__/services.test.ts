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

  // Feature: clean-architecture-refactor, Property 2: Service throws AppError(404) when findById/findByIdAndDelete returns null
  it('Property 2: throws AppError(404) when findById/findByIdAndDelete returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (id: string) => {
          // getById: findById().populate().lean() returns null
          ;(MockedPropertyModel.findById as jest.Mock).mockReturnValue({
            populate: () => ({
              lean: () => Promise.resolve(null),
            }),
          })

          const service = new PropertyService()

          const errGetById = await service.getById(id).catch((e: unknown) => e)
          expect(errGetById).toBeInstanceOf(AppError)
          expect((errGetById as AppError).httpStatus).toBe(404)

          // updateProperty: findById() returns null
          ;(MockedPropertyModel.findById as jest.Mock).mockResolvedValue(null)
          const errUpdate = await service.updateProperty(id, {}).catch((e: unknown) => e)
          expect(errUpdate).toBeInstanceOf(AppError)
          expect((errUpdate as AppError).httpStatus).toBe(404)

          // deleteProperty: findByIdAndDelete returns null
          ;(MockedPropertyModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null)
          const errDelete = await service.deleteProperty(id).catch((e: unknown) => e)
          expect(errDelete).toBeInstanceOf(AppError)
          expect((errDelete as AppError).httpStatus).toBe(404)
        }
      ),
      { numRuns: 100 },
    )
  })

  // Feature: clean-architecture-refactor, Property 3: PropertyService.listProperties issues queries via aggregate
  it('Property 3: listProperties uses aggregate and returns data + total', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (page: number) => {
          jest.clearAllMocks()
          const pageSize = 10
          const fakeResult = {
            data: [],
            count: [{ total: 0 }],
            activeCount: [{ total: 0 }],
            featuredCount: [{ total: 0 }],
          }

          ;(MockedPropertyModel.aggregate as jest.Mock).mockResolvedValue([fakeResult])

          const service = new PropertyService()
          const result = await service.listProperties({}, { page, pageSize })

          expect(MockedPropertyModel.aggregate).toHaveBeenCalledTimes(1)
          expect(result).toMatchObject({
            data: [],
            total: 0,
            page,
            pageSize,
          })
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

  // Feature: clean-architecture-refactor, Property 2: Service throws AppError(404) when findById/findByIdAndDelete returns null
  it('Property 2: throws AppError(404) when findById/findByIdAndDelete returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (id: string) => {
          // findOne for username check returns null (no conflict)
          // findById for the actual user lookup returns null → triggers 404
          ;(MockedUserModel.findOne as jest.Mock).mockReturnValue({
            lean: () => Promise.resolve(null),
          })
          ;(MockedUserModel.findById as jest.Mock).mockResolvedValue(null)

          const service = new UserService()

          const errUpdate = await service.updateUser(id, {}).catch((e: unknown) => e)
          expect(errUpdate).toBeInstanceOf(AppError)
          expect((errUpdate as AppError).httpStatus).toBe(404)

          // deleteUser: use a different requesterId to avoid the 403 self-deletion guard
          ;(MockedUserModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null)
          const errDelete = await service.deleteUser(id, id + '-other').catch((e: unknown) => e)
          expect(errDelete).toBeInstanceOf(AppError)
          expect((errDelete as AppError).httpStatus).toBe(404)
        }
      ),
      { numRuns: 100 },
    )
  })
})

import * as fc from 'fast-check'
import { Request, Response, NextFunction } from 'express'
import { errorHandler } from '../middleware/errorHandler'
import { AppError } from '../errors/AppError'

function makeMockRes() {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeMockReq(): Request {
  return { method: 'GET', url: '/test' } as Request
}

const noop: NextFunction = jest.fn()

// Feature: clean-architecture-refactor, Property 5: AppError status code round-trip
test('Property 5: AppError status code round-trip', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 100, max: 599 }),
      fc.string({ minLength: 1 }),
      (httpStatus, message) => {
        const req = makeMockReq()
        const res = makeMockRes()
        const err = new AppError(httpStatus, message)

        errorHandler(err, req, res, noop)

        expect(res.status).toHaveBeenCalledWith(httpStatus)
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.any(String) })
        )
      }
    ),
    { numRuns: 100 }
  )
})

// Feature: clean-architecture-refactor, Property 6: Non-AppError yields HTTP 500
test('Property 6: Non-AppError yields HTTP 500', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.constant(undefined),
        fc.record({ message: fc.string() })
      ),
      (nonAppError) => {
        const req = makeMockReq()
        const res = makeMockRes()

        errorHandler(nonAppError, req, res, noop)

        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.any(String) })
        )
      }
    ),
    { numRuns: 100 }
  )
})

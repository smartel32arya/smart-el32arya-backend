// Feature: clean-architecture-refactor, Property 4: asyncHandler forwards errors to next

import * as fc from 'fast-check'
import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'

/**
 * Validates: Requirements 9.1, 9.3
 *
 * Property 4: asyncHandler forwards errors to next
 * For any arbitrary error value, when an async handler rejects with that error,
 * asyncHandler must call next() with exactly that error.
 */
describe('asyncHandler', () => {
  it('Property 4: forwards any rejected error to next', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.record({ message: fc.string(), code: fc.integer() }),
          fc.constant(new Error('test error')),
          fc.boolean(),
        ),
        async (errorValue) => {
          const req = {} as Request
          const res = {} as Response
          const next = jest.fn() as unknown as NextFunction

          const handler = asyncHandler(() => Promise.reject(errorValue))
          await handler(req, res, next)

          expect(next).toHaveBeenCalledTimes(1)
          expect(next).toHaveBeenCalledWith(errorValue)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: clean-architecture-refactor, Property 7: Config fails fast on missing variable

import * as fc from 'fast-check'

// Prevent dotenv from loading the .env file so we fully control process.env in tests
jest.mock('dotenv', () => ({ config: jest.fn() }))

/**
 * Validates: Requirements 7.2
 *
 * Property 7: Config fails fast on missing variable
 * For any non-empty subset of the required environment variables that is absent at startup,
 * the Config module must throw an error naming the missing variable before the server
 * begins accepting connections.
 */

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
]

describe('config', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.resetModules()
  })

  it('Property 7: throws an error naming the missing variable when any required env var is absent', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty subset of required env var names to remove
        fc.subarray(REQUIRED_ENV_VARS, { minLength: 1 }),
        (missingVars) => {
          // Set all required vars to valid values first
          for (const key of REQUIRED_ENV_VARS) {
            process.env[key] = 'test-value'
          }

          // Remove the chosen subset
          for (const key of missingVars) {
            delete process.env[key]
          }

          jest.resetModules()

          let threw = false
          let errorMessage = ''
          try {
            // Re-require config so module-level side effects run with the mutated env
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('../config')
          } catch (err) {
            threw = true
            errorMessage = err instanceof Error ? err.message : String(err)
          }

          // Must have thrown
          expect(threw).toBe(true)

          // The error message must name at least one of the missing variables
          const namesAtLeastOneMissing = missingVars.some((key) =>
            errorMessage.includes(key)
          )
          expect(namesAtLeastOneMissing).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

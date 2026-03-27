import * as fs from 'fs'
import * as path from 'path'
import * as fc from 'fast-check'

// Feature: clean-architecture-refactor, Property 1: Layer isolation — Service has no HTTP imports

const SERVICE_FILES = [
  path.resolve(__dirname, '../modules/properties/services/PropertyService.ts'),
  path.resolve(__dirname, '../modules/auth/services/AuthService.ts'),
  path.resolve(__dirname, '../modules/users/services/UserService.ts'),
]

const HTTP_IMPORT_PATTERNS = [
  /import\s+.*from\s+['"]express['"]/,
  /require\s*\(\s*['"]express['"]\s*\)/,
  /import\s+.*from\s+['"]fastify['"]/,
  /import\s+.*from\s+['"]koa['"]/,
  /import\s+.*from\s+['"]hapi['"]/,
  /import\s+.*from\s+['"]http['"]/,
  /import\s+.*from\s+['"]https['"]/,
]

function fileContainsHttpImport(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8')
  return HTTP_IMPORT_PATTERNS.some((pattern) => pattern.test(content))
}

describe('Architecture: Layer Isolation', () => {
  describe('Unit tests — Service files have no HTTP framework imports', () => {
    test.each(SERVICE_FILES)('%s does not import express or any HTTP framework', (filePath) => {
      expect(fileContainsHttpImport(filePath)).toBe(false)
    })
  })

  // **Validates: Requirements 1.1, 2.4**
  describe('Property 1: Layer isolation — Service has no HTTP imports', () => {
    it('holds for all service files across 100 runs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SERVICE_FILES),
          async (filePath) => {
            const hasHttpImport = fileContainsHttpImport(filePath)
            return hasHttpImport === false
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

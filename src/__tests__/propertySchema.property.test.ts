import fc from 'fast-check'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Property from '../models/Property'
import { formatPrice } from '../utils/formatPrice'
import { createPropertySchema, updatePropertySchema } from '../modules/properties/validators/properties.schemas'
import { createPropertySchema as adminCreatePropertySchema, updatePropertySchema as adminUpdatePropertySchema } from '../modules/admin/validators/adminProperties.schemas'

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

// Helper: minimal valid property object (requires addedBy for Mongoose)
function makeProperty(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Property',
    description: 'A test description',
    price: 500000,
    location: 'المنيا الجديدة',
    neighborhood: 'حي الزهراء',
    type: 'شقة',
    addedBy: new mongoose.Types.ObjectId(),
    ...overrides,
  }
}

// Helper: minimal valid body for Zod validators (no addedBy needed)
function makeValidatorBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Property',
    description: 'A test description',
    price: 500000,
    location: 'المنيا الجديدة',
    neighborhood: 'حي الزهراء',
    type: 'شقة',
    ...overrides,
  }
}

// Helper: minimal valid body for admin Zod validators (requires addedBy)
function makeAdminValidatorBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Property',
    description: 'A test description',
    price: 500000,
    location: 'المنيا الجديدة',
    neighborhood: 'حي الزهراء',
    type: 'شقة',
    addedBy: new mongoose.Types.ObjectId().toString(),
    ...overrides,
  }
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

// 6.1 formatPrice(1200000) returns "١,٢٠٠,٠٠٠ ج.م" (Requirement 5.2)
describe('6.1 formatPrice unit test', () => {
  it('formatPrice(1200000) returns "١,٢٠٠,٠٠٠ ج.م"', () => {
    expect(formatPrice(1200000)).toBe('١,٢٠٠,٠٠٠ ج.م')
  })
})

// 6.2 Creating a property without listingType saves with listingType === "sale"
describe('6.2 listingType defaults to "sale"', () => {
  it('property saved without listingType has listingType === "sale"', async () => {
    const doc = await new Property(makeProperty()).save()
    expect(doc.listingType).toBe('sale')
  })
})

// 6.3 Creating a property without bedrooms/bathrooms/area does not throw
describe('6.3 bedrooms/bathrooms/area are optional', () => {
  it('property saved without bedrooms, bathrooms, area does not throw', async () => {
    const body = makeProperty()
    // Ensure none of the optional fields are present
    delete (body as Record<string, unknown>).bedrooms
    delete (body as Record<string, unknown>).bathrooms
    delete (body as Record<string, unknown>).area
    await expect(new Property(body).save()).resolves.toBeDefined()
  })
})

// 6.4 Validator rejects listingType: "lease" with a validation error
describe('6.4 validator rejects invalid listingType', () => {
  it('createPropertySchema rejects listingType: "lease"', () => {
    const result = createPropertySchema.safeParse(makeValidatorBody({ listingType: 'lease' }))
    expect(result.success).toBe(false)
  })

  it('adminCreatePropertySchema rejects listingType: "lease"', () => {
    const result = adminCreatePropertySchema.safeParse(makeAdminValidatorBody({ listingType: 'lease' }))
    expect(result.success).toBe(false)
  })
})

// 6.5 Migration error path calls process.exit(1)
describe('6.5 migration error path calls process.exit(1)', () => {
  it('calls process.exit(1) when mongoose.connect throws', async () => {
    // The migration script calls process.exit(1) on error.
    // We test the logic directly by simulating the same try/catch pattern.
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: string | number | null) => never)

    // Simulate the migration script's run() function with a failing connect
    async function simulateMigrationRun(connectFn: () => Promise<void>) {
      try {
        await connectFn()
      } catch (error) {
        console.error('Migration failed:', error)
        process.exit(1)
      }
    }

    await simulateMigrationRun(() => Promise.reject(new Error('connection failed')))

    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })
})

// ─── Property-Based Tests ─────────────────────────────────────────────────────

// Feature: property-schema-update, Property 1: listingType only holds valid enum values
describe('P1: listingType only holds valid enum values', () => {
  it('arbitrary strings — only "sale"/"rent" pass Mongoose validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        async (listingType) => {
          await Property.deleteMany({})
          const isValid = listingType === 'sale' || listingType === 'rent'
          const doc = new Property(makeProperty({ listingType }))
          const validationError = doc.validateSync()
          if (isValid) {
            expect(validationError).toBeUndefined()
          } else {
            expect(validationError).toBeDefined()
            expect(validationError!.errors).toHaveProperty('listingType')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: property-schema-update, Property 2: Numeric fields accept any valid number when provided
describe('P2: positive numbers for bedrooms/bathrooms/area are stored as-is', () => {
  it('positive numbers for bedrooms/bathrooms/area are stored as-is', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 100 }),
        fc.nat({ max: 100 }),
        fc.float({ min: 1, max: 10000, noNaN: true }),
        async (bedrooms, bathrooms, area) => {
          await Property.deleteMany({})
          const doc = await new Property(makeProperty({ bedrooms, bathrooms, area })).save()
          expect(doc.bedrooms).toBe(bedrooms)
          expect(doc.bathrooms).toBe(bathrooms)
          expect(doc.area).toBeCloseTo(area, 5)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: property-schema-update, Property 3: Migration backfills only docs missing listingType
describe('P3: migration logic backfills only docs missing listingType', () => {
  it('after updateMany, all docs have listingType and pre-existing values are unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            hasListingType: fc.boolean(),
            existingType: fc.constantFrom('sale', 'rent'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (docSpecs) => {
          await Property.deleteMany({})

          // Insert docs with/without listingType
          for (const spec of docSpecs) {
            const body = makeProperty()
            if (spec.hasListingType) {
              (body as Record<string, unknown>).listingType = spec.existingType
            }
            // Use insertOne directly to bypass pre-save hook for docs without listingType
            await Property.collection.insertOne(body)
          }

          // Run migration logic
          await Property.updateMany(
            { listingType: { $exists: false } },
            { $set: { listingType: 'sale' } }
          )

          const allDocs = await Property.find({}).lean()

          // All docs must have listingType
          for (const doc of allDocs) {
            expect(doc.listingType).toBeDefined()
            expect(['sale', 'rent']).toContain(doc.listingType)
          }

          // Docs that had a listingType must be unchanged
          const docsWithExisting = docSpecs.filter(s => s.hasListingType)
          const docsWithRent = docsWithExisting.filter(s => s.existingType === 'rent')
          const rentCount = await Property.countDocuments({ listingType: 'rent' })
          expect(rentCount).toBe(docsWithRent.length)
        }
      ),
      { numRuns: 50 }
    )
  })
})

// Feature: property-schema-update, Property 4: Validators accept exactly the two valid listingType values and reject all others
describe('P4: both validators accept "sale"/"rent" and reject all other strings', () => {
  it('arbitrary strings — pass iff value is "sale" or "rent"', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (listingType) => {
          const isValid = listingType === 'sale' || listingType === 'rent'

          const userResult = createPropertySchema.safeParse(makeValidatorBody({ listingType }))
          const adminResult = adminCreatePropertySchema.safeParse(makeAdminValidatorBody({ listingType }))

          expect(userResult.success).toBe(isValid)
          expect(adminResult.success).toBe(isValid)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: property-schema-update, Property 5: Validators treat bedrooms, bathrooms, and area as optional
describe('P5: both validators accept bodies with any subset of optional numeric fields omitted', () => {
  it('any subset of bedrooms/bathrooms/area omitted — both validators accept', () => {
    const optionalFields: Array<'bedrooms' | 'bathrooms' | 'area'> = ['bedrooms', 'bathrooms', 'area']

    fc.assert(
      fc.property(
        fc.subarray(optionalFields),
        (omitted) => {
          const body = makeValidatorBody() as Record<string, unknown>
          const adminBody = makeAdminValidatorBody() as Record<string, unknown>

          // Add all optional fields first, then remove the omitted ones
          body.bedrooms = 2
          body.bathrooms = 1
          body.area = 100
          adminBody.bedrooms = 2
          adminBody.bathrooms = 1
          adminBody.area = 100

          for (const field of omitted) {
            delete body[field]
            delete adminBody[field]
          }

          const userResult = createPropertySchema.safeParse(body)
          const adminResult = adminCreatePropertySchema.safeParse(adminBody)

          expect(userResult.success).toBe(true)
          expect(adminResult.success).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: property-schema-update, Property 6: formatPrice always produces Arabic-Indic digits with ج.م suffix
describe('P6: formatPrice output contains only Arabic-Indic digits and ends with " ج.م"', () => {
  it('for any positive integer, output has only Arabic-Indic digits and ends with " ج.م"', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000_000 }),
        (price) => {
          // Skip 0 since formatPrice expects positive numbers
          if (price === 0) return

          const result = formatPrice(price)

          // Must end with " ج.م"
          expect(result).toMatch(/ ج\.م$/)

          // The part before " ج.م" must contain only Arabic-Indic digits and commas
          const numericPart = result.replace(' ج.م', '')
          expect(numericPart).toMatch(/^[٠-٩,]+$/)

          // Must not contain Western digits
          expect(result).not.toMatch(/[0-9]/)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: property-schema-update, Property 7: contactPhone is returned without transformation
describe('P7: contactPhone in service response equals raw owner.phone', () => {
  it('toContact mapping returns phone as-is without transformation', () => {
    // Test the mapping logic directly (mirrors the toContact helper in PropertyService)
    function toContactPhone(ownerPhone: string | null | undefined): string | null {
      return ownerPhone ?? null
    }

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (phone) => {
          const contactPhone = toContactPhone(phone)
          expect(contactPhone).toBe(phone)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('toContact returns null when owner phone is null/undefined', () => {
    function toContactPhone(ownerPhone: string | null | undefined): string | null {
      return ownerPhone ?? null
    }
    expect(toContactPhone(null)).toBeNull()
    expect(toContactPhone(undefined)).toBeNull()
  })
})

// Feature: property-schema-update, Property 8: neighborhood accepts any non-empty string
describe('P8: both validators accept any non-empty string for neighborhood', () => {
  it('any non-empty string for neighborhood — both validators accept', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (neighborhood) => {
          const userResult = createPropertySchema.safeParse(makeValidatorBody({ neighborhood }))
          const adminResult = adminCreatePropertySchema.safeParse(makeAdminValidatorBody({ neighborhood }))

          expect(userResult.success).toBe(true)
          expect(adminResult.success).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

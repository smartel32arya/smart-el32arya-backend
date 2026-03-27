// Feature: clean-architecture-refactor, Property 8: Zod validation rejects invalid bodies

import * as fc from 'fast-check'
import { createPropertySchema, updatePropertySchema } from '../modules/properties/validators/properties.schemas'
import { createUserSchema, updateUserSchema } from '../modules/users/validators/users.schemas'
import { loginSchema } from '../modules/auth/validators/auth.schemas'

// ─── createPropertySchema ────────────────────────────────────────────────────

describe('createPropertySchema', () => {
  it('accepts a valid property body', () => {
    const valid = {
      title: 'Test Property',
      description: 'A nice place',
      price: 500000,
      location: 'Cairo',
      neighborhood: 'Maadi',
      type: 'apartment',
      bedrooms: 3,
      bathrooms: 2,
      area: 120,
    }
    expect(createPropertySchema.safeParse(valid).success).toBe(true)
  })

  it('Property 8 — rejects any body missing a required field or with wrong types', () => {
    // Validates: Requirements 9.1
    fc.assert(
      fc.property(
        fc.oneof(
          // missing required fields
          fc.constant({}),
          fc.record({ title: fc.string({ minLength: 1 }) }), // missing price, location, etc.
          // wrong types for required string fields
          fc.record({
            title: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)),
            description: fc.string({ minLength: 1 }),
            price: fc.integer({ min: 1 }),
            location: fc.string({ minLength: 1 }),
            neighborhood: fc.string({ minLength: 1 }),
            type: fc.string({ minLength: 1 }),
            bedrooms: fc.integer({ min: 0 }),
            bathrooms: fc.integer({ min: 0 }),
            area: fc.integer({ min: 1 }),
          }),
          // invalid numeric values
          fc.record({
            title: fc.string({ minLength: 1 }),
            description: fc.string({ minLength: 1 }),
            price: fc.oneof(fc.constant(-1), fc.constant(0)),
            location: fc.string({ minLength: 1 }),
            neighborhood: fc.string({ minLength: 1 }),
            type: fc.string({ minLength: 1 }),
            bedrooms: fc.integer({ min: 0 }),
            bathrooms: fc.integer({ min: 0 }),
            area: fc.integer({ min: 1 }),
          }),
          // empty required strings
          fc.record({
            title: fc.constant(''),
            description: fc.string({ minLength: 1 }),
            price: fc.integer({ min: 1 }),
            location: fc.string({ minLength: 1 }),
            neighborhood: fc.string({ minLength: 1 }),
            type: fc.string({ minLength: 1 }),
            bedrooms: fc.integer({ min: 0 }),
            bathrooms: fc.integer({ min: 0 }),
            area: fc.integer({ min: 1 }),
          }),
        ),
        (body) => {
          const result = createPropertySchema.safeParse(body)
          return result.success === false
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── updatePropertySchema ────────────────────────────────────────────────────

describe('updatePropertySchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(updatePropertySchema.safeParse({}).success).toBe(true)
  })

  it('accepts a partial valid update', () => {
    expect(updatePropertySchema.safeParse({ price: 100000 }).success).toBe(true)
  })

  it('Property 8 — rejects invalid field values even when partial', () => {
    // Validates: Requirements 9.1
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({ price: fc.oneof(fc.constant(-1), fc.constant(0), fc.string()) }),
          fc.record({ bedrooms: fc.constant(-1) }),
          fc.record({ bathrooms: fc.constant(-1) }),
          fc.record({ area: fc.oneof(fc.constant(-1), fc.constant(0)) }),
          fc.record({ title: fc.constant('') }),
        ),
        (body) => {
          const result = updatePropertySchema.safeParse(body)
          return result.success === false
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── createUserSchema ────────────────────────────────────────────────────────

describe('createUserSchema', () => {
  it('accepts a valid user body', () => {
    const valid = {
      name: 'Ahmed Ali',
      username: 'ahmed_ali',
      password: 'secret123',
      role: 'property_admin',
    }
    expect(createUserSchema.safeParse(valid).success).toBe(true)
  })

  it('Property 8 — rejects any body missing a required field or with wrong types', () => {
    // Validates: Requirements 9.1
    fc.assert(
      fc.property(
        fc.oneof(
          // missing all required fields
          fc.constant({}),
          // name too short
          fc.record({
            name: fc.string({ maxLength: 1 }),
            username: fc.string({ minLength: 3 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc.string({ minLength: 6 }),
            role: fc.constant('property_admin' as const),
          }),
          // password too short
          fc.record({
            name: fc.string({ minLength: 2 }),
            username: fc.string({ minLength: 3 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc.string({ maxLength: 5 }),
            role: fc.constant('property_admin' as const),
          }),
          // invalid role
          fc.record({
            name: fc.string({ minLength: 2 }),
            username: fc.string({ minLength: 3 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc.string({ minLength: 6 }),
            role: fc.string().filter(r => r !== 'super_admin' && r !== 'property_admin'),
          }),
          // username too short
          fc.record({
            name: fc.string({ minLength: 2 }),
            username: fc.string({ maxLength: 2 }),
            password: fc.string({ minLength: 6 }),
            role: fc.constant('property_admin' as const),
          }),
        ),
        (body) => {
          const result = createUserSchema.safeParse(body)
          return result.success === false
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── updateUserSchema ────────────────────────────────────────────────────────

describe('updateUserSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a partial valid update', () => {
    expect(updateUserSchema.safeParse({ name: 'New Name' }).success).toBe(true)
  })

  it('Property 8 — rejects invalid field values even when partial', () => {
    // Validates: Requirements 9.1
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({ name: fc.string({ maxLength: 1 }) }),
          fc.record({ password: fc.string({ maxLength: 5 }) }),
          fc.record({ role: fc.string().filter(r => r !== 'super_admin' && r !== 'property_admin') }),
        ),
        (body) => {
          const result = updateUserSchema.safeParse(body)
          return result.success === false
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── loginSchema ─────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts a valid login body', () => {
    const valid = { username: 'user_user', password: 'pass123' }
    expect(loginSchema.safeParse(valid).success).toBe(true)
  })

  it('Property 8 — rejects any body missing a required field or with empty values', () => {
    // Validates: Requirements 9.1
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({}),                                        // missing both
          fc.record({ password: fc.string({ minLength: 1 }) }),  // missing username
          fc.record({ username: fc.string({ minLength: 1 }) }),     // missing password
          fc.record({ username: fc.constant(''), password: fc.string({ minLength: 1 }) }), // empty username
          fc.record({ username: fc.string({ minLength: 1 }), password: fc.constant('') }), // empty password
        ),
        (body) => {
          const result = loginSchema.safeParse(body)
          return result.success === false
        }
      ),
      { numRuns: 100 }
    )
  })
})

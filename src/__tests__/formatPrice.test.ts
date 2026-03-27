import fc from 'fast-check'
import { formatPrice } from '../utils/formatPrice'

// Feature: clean-architecture-refactor, Property 11: formatPrice round-trip
test('Property 11: formatPrice round-trip — Arabic digits and ج.م suffix, numeric value preserved', () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 999_999_999 }), (price) => {
      const formatted = formatPrice(price)
      // Assert the result contains the suffix 'ج.م'
      expect(formatted).toContain('ج.م')
      // Assert the result contains Arabic-Indic digits (no Western digits)
      expect(formatted).toMatch(/[٠-٩]/)
      expect(formatted).not.toMatch(/[0-9]/)
      // Convert Arabic-Indic digits back to Western digits and strip commas/spaces
      const stripped = formatted
        .replace(' ج.م', '')
        .replace(/,/g, '')
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      // Assert the numeric value equals the original price
      expect(Number(stripped)).toBe(price)
    }),
    { numRuns: 100 }
  )
})

// Feature: smart-realestate-backend, Property 1: Price format round trip
test('formatPrice round trip', () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 999_999_999 }), (price) => {
      const formatted = formatPrice(price)
      const stripped = formatted
        .replace(' ج.م', '')
        .replace(/,/g, '')
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      expect(Number(stripped)).toBe(price)
    }),
    { numRuns: 100 }
  )
})

// Feature: smart-realestate-backend, Property 2: Arabic digits only
test('formatPrice contains only Arabic digits', () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 999_999_999 }), (price) => {
      const formatted = formatPrice(price)
      expect(formatted).toMatch(/^[٠-٩,]+ ج\.م$/)
      expect(formatted).not.toMatch(/[0-9]/)
    }),
    { numRuns: 100 }
  )
})

// Unit examples
test('formatPrice(2500000) === "٢,٥٠٠,٠٠٠ ج.م"', () => {
  expect(formatPrice(2500000)).toBe('٢,٥٠٠,٠٠٠ ج.م')
})

test('formatPrice(1000000) === "١,٠٠٠,٠٠٠ ج.م"', () => {
  expect(formatPrice(1000000)).toBe('١,٠٠٠,٠٠٠ ج.م')
})

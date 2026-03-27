/**
 * Parse boolean string fields from multipart/form-data bodies.
 * Multer sends all fields as strings; this converts them to booleans.
 */
export function parseFormDataBooleans(body: Record<string, string>): {
  featured: boolean
  active: boolean
  showPrice: boolean
} {
  return {
    featured: body.featured === 'true',
    active: body.active === 'true',
    showPrice: body.showPrice !== 'false',
  }
}

/**
 * Parse amenities from multipart/form-data body.
 * Accepts either a JSON string or an already-parsed array.
 */
export function parseAmenities(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as string[]
    } catch {
      return []
    }
  }
  return []
}

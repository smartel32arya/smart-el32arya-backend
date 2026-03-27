import { z } from 'zod'

export const createPropertySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.number().positive(),
  location: z.string().min(1),
  neighborhood: z.string().min(1),
  type: z.string().min(1),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  area: z.number().positive(),
  images: z.array(z.string()).default([]),
  video: z.string().nullable().default(null),
  amenities: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  showPrice: z.boolean().default(true),
})

export const updatePropertySchema = createPropertySchema.partial()

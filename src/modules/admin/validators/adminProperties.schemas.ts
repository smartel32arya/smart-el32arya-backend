import { z } from 'zod'

const str = (msg: string) => z.string({ error: msg }).min(1, msg)
const pos = (msg: string) => z.number({ error: msg }).positive(msg)
const int = (msg: string) => z.number({ error: msg }).int(msg).min(0, msg)

export const createPropertySchema = z.object({
  title:        str('العنوان مطلوب'),
  description:  str('الوصف مطلوب'),
  price:        pos('السعر يجب أن يكون رقماً موجباً'),
  location:     str('الموقع مطلوب'),
  neighborhood: str('الحي مطلوب'),
  type:         str('نوع العقار مطلوب'),
  bedrooms:     int('عدد غرف النوم يجب أن يكون رقماً صحيحاً'),
  bathrooms:    int('عدد الحمامات يجب أن يكون رقماً صحيحاً'),
  area:         pos('المساحة يجب أن تكون رقماً موجباً'),
  images:       z.array(z.string()).default([]),
  video:        z.string().nullable().default(null),
  amenities:    z.array(z.string()).default([]),
  featured:     z.boolean().default(false),
  active:       z.boolean().default(true),
  showPrice:    z.boolean().default(true),
  addedBy:      z.string({ error: 'معرف المضيف مطلوب' }).min(1),
})

export const updatePropertySchema = createPropertySchema.partial()

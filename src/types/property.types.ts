import { Types } from 'mongoose'

export interface IProperty {
  _id: string
  title: string
  description: string
  price: number
  priceFormatted: string
  showPrice: boolean
  location: string
  neighborhood: string
  type: string
  listingType: 'sale' | 'rent'
  bedrooms?: number
  bathrooms?: number
  area?: number
  image: string
  images: string[]
  video: string | null
  amenities: string[]
  featured: boolean
  active: boolean
  addedBy: Types.ObjectId   // ref to User._id
  createdAt: string
}

export interface PropertyFilter {
  neighborhood?: string
  type?: string
  priceMin?: number
  priceMax?: number
  active?: boolean
  addedBy?: string       // when set, only returns properties created by this user
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'area-desc'
}

export interface PropertyPagination {
  page: number
  pageSize: number
}

export interface PropertyListResult {
  data: PropertyWithContact[]
  total: number
  totalActive: number
  totalFeatured: number
  page: number
  pageSize: number
  totalPages: number
}

export type CreatePropertyDto = Omit<IProperty, '_id' | 'priceFormatted' | 'image' | 'createdAt'>
export type UpdatePropertyDto = Partial<CreatePropertyDto>

/** Property enriched with the owner's WhatsApp number for public-facing responses. */
export interface PropertyWithContact extends Omit<IProperty, 'addedBy'> {
  addedBy: string
  contactPhone: string | null
}

/** Property enriched with owner status for super_admin responses. */
export interface PropertyAdminView extends Omit<IProperty, 'addedBy'> {
  addedBy: string
  contactPhone: string | null
  ownerSuspended: boolean   // true when the owner is inactive or expired
  ownerActive: boolean
}

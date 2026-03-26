import { Schema, model, Document } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { formatPrice } from '../utils/formatPrice'

export interface IProperty {
  id: string
  title: string
  description: string
  price: number
  priceFormatted: string
  showPrice: boolean
  location: string
  neighborhood: string
  type: string
  bedrooms: number
  bathrooms: number
  area: number
  image: string
  images: string[]
  video: string | null
  amenities: string[]
  featured: boolean
  active: boolean
  createdAt: string
}

const PropertySchema = new Schema<IProperty & Document>(
  {
    id: { type: String, default: uuidv4 },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    priceFormatted: { type: String, default: '' },
    showPrice: { type: Boolean, default: true },
    location: { type: String, required: true },
    neighborhood: { type: String, required: true },
    type: { type: String, required: true },
    bedrooms: { type: Number, required: true },
    bathrooms: { type: Number, required: true },
    area: { type: Number, required: true },
    image: { type: String, default: '' },
    images: { type: [String], default: [] },
    video: { type: String, default: null },
    amenities: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
)

// Indexes
PropertySchema.index({ active: 1 })
PropertySchema.index({ featured: 1 })
PropertySchema.index({ neighborhood: 1 })
PropertySchema.index({ type: 1 })
PropertySchema.index({ price: 1 })

// Pre-save hook — task 2.2
PropertySchema.pre('save', function (next) {
  if (this.images && this.images.length > 0) {
    this.image = this.images[0]
  }
  this.priceFormatted = formatPrice(this.price)
  next()
})

const Property = model<IProperty & Document>('Property', PropertySchema)

export default Property

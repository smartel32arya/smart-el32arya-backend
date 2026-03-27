import { Schema, model, Document, Types } from 'mongoose'
import { formatPrice } from '../utils/formatPrice'

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
  bedrooms: number
  bathrooms: number
  area: number
  image: string
  images: string[]
  video: string | null
  amenities: string[]
  featured: boolean
  active: boolean
  addedBy: Types.ObjectId   // ref to User._id
  createdAt: string
}

const PropertySchema = new Schema<IProperty & Document>(
  {
    title:        { type: String, required: true },
    description:  { type: String, required: true },
    price:        { type: Number, required: true },
    priceFormatted: { type: String, default: '' },
    showPrice:    { type: Boolean, default: true },
    location:     { type: String, required: true },
    neighborhood: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    bedrooms:  { type: Number, required: true },
    bathrooms: { type: Number, required: true },
    area:      { type: Number, required: true },
    image:     { type: String, default: '' },
    images:    { type: [String], default: [] },
    video:     { type: String, default: null },
    amenities: { type: [String], default: [] },
    featured:  { type: Boolean, default: false },
    active:    { type: Boolean, default: true },
    addedBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Compound indexes for common filter combinations
PropertySchema.index({ active: 1, featured: 1 })
PropertySchema.index({ active: 1, neighborhood: 1 })
PropertySchema.index({ active: 1, type: 1 })
PropertySchema.index({ price: 1 })

PropertySchema.pre('save', function (next) {
  if (this.images && this.images.length > 0) {
    this.image = this.images[0]
  }
  this.priceFormatted = formatPrice(this.price)
  next()
})

const Property = model<IProperty & Document>('Property', PropertySchema)

export default Property

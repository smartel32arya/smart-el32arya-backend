import { PropertyService } from '../../properties/services/PropertyService'
import { AppError } from '../../../errors/AppError'
import {
  uploadToCloudinary,
  uploadVideoToCloudinary,
  deleteFromCloudinary,
} from '../../../middleware/imageUploader'
import { parseFormDataBooleans, parseAmenities } from '../../../utils/parseFormData'
import { createPropertySchema, updatePropertySchema } from '../validators/adminProperties.schemas'
import { IProperty, PropertyAdminView, PropertyFilter, PropertyPagination, PropertyListResult, PropertyWithContact } from '../../../types/property.types'

const propertyService = new PropertyService()

export type CreatePropertyInput = {
  body: Record<string, string>
  imageFiles: Express.Multer.File[]
  videoFiles: Express.Multer.File[]
  addedBy: string
}

export type UpdatePropertyInput = {
  body: Record<string, string>
  imageFiles: Express.Multer.File[]
  videoFiles: Express.Multer.File[]
  existing: IProperty
}

export class AdminPropertyService {
  // ── List / Get ────────────────────────────────────────────────────────────

  async listForSuperAdmin(
    filter: PropertyFilter,
    pagination: PropertyPagination,
  ): Promise<{ data: PropertyAdminView[]; total: number; page: number; pageSize: number; totalPages: number }> {
    return propertyService.listPropertiesAdmin(filter, pagination)
  }

  async listForPropertyAdmin(
    filter: PropertyFilter,
    pagination: PropertyPagination,
  ): Promise<PropertyListResult> {
    return propertyService.listProperties(filter, pagination)
  }

  async getByIdForSuperAdmin(id: string): Promise<PropertyAdminView> {
    return propertyService.getByIdAdmin(id)
  }

  async getByIdForPropertyAdmin(id: string): Promise<PropertyWithContact> {
    return propertyService.getById(id)
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreatePropertyInput): Promise<IProperty> {
    const { body, imageFiles, videoFiles, addedBy } = input

    const images: string[] = imageFiles.length > 0
      ? await Promise.all(imageFiles.map((f) => uploadToCloudinary(f.buffer, f.mimetype)))
      : []

    const video: string | null = videoFiles.length > 0
      ? await uploadVideoToCloudinary(videoFiles[0].buffer)
      : null

    const { featured, active, showPrice } = parseFormDataBooleans(body)
    const amenities = parseAmenities(body.amenities)

    const rawDto = {
      title:        body.title,
      description:  body.description,
      price:        parseFloat(body.price),
      location:     body.location,
      neighborhood: body.neighborhood,
      type:         body.type,
      bedrooms:     parseInt(body.bedrooms, 10),
      bathrooms:    parseInt(body.bathrooms, 10),
      area:         parseFloat(body.area),
      images,
      video,
      amenities,
      featured,
      active,
      showPrice,
      addedBy,
    }

    const result = createPropertySchema.safeParse(rawDto)
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'بيانات غير صالحة')

    return propertyService.createProperty(result.data as unknown as import('../../../types/property.types').CreatePropertyDto)
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdatePropertyInput): Promise<IProperty> {
    const { body, imageFiles, videoFiles, existing } = input

    // Images — preserve existing unless overridden
    let keptImages: string[] = existing.images ?? []
    if (body.existingImages !== undefined) {
      keptImages = typeof body.existingImages === 'string'
        ? JSON.parse(body.existingImages) as string[]
        : body.existingImages
    }

    const removedImages = (existing.images ?? []).filter((url) => !keptImages.includes(url))
    await Promise.all(removedImages.map((url) => deleteFromCloudinary(url, 'image')))

    const newImageUrls = imageFiles.length > 0
      ? await Promise.all(imageFiles.map((f) => uploadToCloudinary(f.buffer, f.mimetype)))
      : []

    const finalImages = [...keptImages, ...newImageUrls]

    // Video — preserve existing unless overridden
    let finalVideo: string | null = existing.video ?? null
    if (videoFiles.length > 0) {
      if (existing.video) await deleteFromCloudinary(existing.video, 'video')
      finalVideo = await uploadVideoToCloudinary(videoFiles[0].buffer)
    } else if (body.videoUrl !== undefined) {
      finalVideo = body.videoUrl || null
    }

    const featured  = body.featured  !== undefined ? body.featured  === 'true'  : existing.featured
    const active    = body.active    !== undefined ? body.active    === 'true'  : existing.active
    const showPrice = body.showPrice !== undefined ? body.showPrice !== 'false' : existing.showPrice
    const amenities = body.amenities !== undefined ? parseAmenities(body.amenities) : existing.amenities

    const rawDto = {
      title:        body.title        ?? existing.title,
      description:  body.description  ?? existing.description,
      price:        body.price        !== undefined ? parseFloat(body.price)       : existing.price,
      location:     body.location     ?? existing.location,
      neighborhood: body.neighborhood ?? existing.neighborhood,
      type:         body.type         ?? existing.type,
      bedrooms:     body.bedrooms     !== undefined ? parseInt(body.bedrooms, 10)  : existing.bedrooms,
      bathrooms:    body.bathrooms    !== undefined ? parseInt(body.bathrooms, 10) : existing.bathrooms,
      area:         body.area         !== undefined ? parseFloat(body.area)        : existing.area,
      images: finalImages,
      video: finalVideo,
      amenities,
      featured,
      active,
      showPrice,
    }

    const result = updatePropertySchema.safeParse(rawDto)
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'بيانات غير صالحة')

    return propertyService.updateProperty(id, result.data as import('../../../types/property.types').UpdatePropertyDto)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string, existing: IProperty): Promise<void> {
    const deletions: Promise<void>[] = (existing.images ?? []).map((url) =>
      deleteFromCloudinary(url, 'image')
    )
    if (existing.video) deletions.push(deleteFromCloudinary(existing.video, 'video'))
    await Promise.all(deletions)

    await propertyService.deleteProperty(id)
  }
}

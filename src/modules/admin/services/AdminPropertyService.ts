import { PropertyService } from '../../properties/services/PropertyService'
import { AppError } from '../../../errors/AppError'
import {
  uploadToCloudinary,
  uploadVideoToCloudinary,
  deleteFromCloudinary,
} from '../../../middleware/imageUploader'
import { createPropertySchema, updatePropertySchema } from '../validators/adminProperties.schemas'
import { IProperty, PropertyAdminView, PropertyFilter, PropertyPagination, PropertyListResult, PropertyWithContact } from '../../../types/property.types'

const propertyService = new PropertyService()

export type CreatePropertyInput = {
  body: Record<string, unknown>
  addedBy: string
}

export type UpdatePropertyDataInput = {
  body: Record<string, unknown>
  existing: IProperty
}

export type UploadImagesInput = {
  imageFiles: Express.Multer.File[]
  existing: IProperty
}

export type ReplaceImagesInput = {
  imageFiles: Express.Multer.File[]
  existingImages: string[] | undefined   // undefined = keep all
  existing: IProperty
}

export type UploadVideoInput = {
  videoFile: Express.Multer.File
  existing: IProperty
}

export class AdminPropertyService {
  // ── List / Get ────────────────────────────────────────────────────────────

  async listForSuperAdmin(
    filter: PropertyFilter,
    pagination: PropertyPagination,
  ): Promise<{ data: PropertyAdminView[]; total: number; totalActive: number; totalFeatured: number; page: number; pageSize: number; totalPages: number }> {
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

  async createProperty(input: CreatePropertyInput): Promise<IProperty> {
    const { body, addedBy } = input

    const result = createPropertySchema.safeParse({ ...body, addedBy })
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'بيانات غير صالحة')

    return propertyService.createProperty({
      ...(result.data as unknown as import('../../../types/property.types').CreatePropertyDto),
      images: result.data.images ?? [],
      video:  result.data.video  ?? null,
    })
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updatePropertyData(id: string, input: UpdatePropertyDataInput): Promise<IProperty> {
    const { body } = input

    const result = updatePropertySchema.safeParse(body)
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'بيانات غير صالحة')

    return propertyService.updateProperty(id, result.data as import('../../../types/property.types').UpdatePropertyDto)
  }

  // ── Images ───────────────────────────────────────────────────────────────

  async uploadImages(id: string, input: UploadImagesInput): Promise<IProperty> {
    const { imageFiles, existing } = input
    const newUrls = await Promise.all(
      imageFiles.map((file) => uploadToCloudinary(file.buffer, file.mimetype))
    )
    return propertyService.updateProperty(id, {
      images: [...(existing.images ?? []), ...newUrls],
    })
  }

  async replaceImages(id: string, input: ReplaceImagesInput): Promise<IProperty> {
    const { imageFiles, existingImages, existing } = input
    const keptImages = existingImages !== undefined ? existingImages : (existing.images ?? [])

    const toDelete = (existing.images ?? []).filter((url) => !keptImages.includes(url))
    await Promise.all(toDelete.map((url) => deleteFromCloudinary(url, 'image')))

    const newUrls = await Promise.all(
      imageFiles.map((file) => uploadToCloudinary(file.buffer, file.mimetype))
    )

    return propertyService.updateProperty(id, {
      images: [...keptImages, ...newUrls],
    })
  }

  // ── Video ─────────────────────────────────────────────────────────────────

  async uploadVideo(id: string, input: UploadVideoInput): Promise<IProperty> {
    const { videoFile } = input
    const newUrl = await uploadVideoToCloudinary(videoFile.buffer)
    return propertyService.updateProperty(id, { video: newUrl })
  }

  async replaceVideo(id: string, input: UploadVideoInput): Promise<IProperty> {
    const { videoFile, existing } = input
    if (existing.video) {
      await deleteFromCloudinary(existing.video, 'video')
    }
    const newUrl = await uploadVideoToCloudinary(videoFile.buffer)
    return propertyService.updateProperty(id, { video: newUrl })
  }

  async removeVideo(id: string, existing: IProperty): Promise<IProperty> {
    if (existing.video) {
      await deleteFromCloudinary(existing.video, 'video')
    }
    return propertyService.updateProperty(id, { video: null })
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

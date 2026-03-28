import { Request, Response } from 'express'
import { asyncHandler } from '../../../middleware/asyncHandler'
import { AdminPropertyService } from '../services/AdminPropertyService'
import { IProperty, PropertyFilter, PropertyPagination } from '../../../types/property.types'
import { AuthRequest } from '../../../types/express'
import { uploadToCloudinary, uploadVideoToCloudinary } from '../../../middleware/imageUploader'

const service = new AdminPropertyService()

export class AdminPropertyController {
  listProperties = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const { neighborhood, type, priceRange, sort, page: pageQ, pageSize: pageSizeQ } = req.query

    const filter: PropertyFilter = {}
    if (neighborhood) filter.neighborhood = neighborhood as string
    if (type)         filter.type = type as string
    if (priceRange && priceRange !== 'all') {
      const parts = (priceRange as string).split('-')
      if (parts.length === 2) {
        const min = parseFloat(parts[0])
        const max = parseFloat(parts[1])
        if (!isNaN(min) && !isNaN(max)) { filter.priceMin = min; filter.priceMax = max }
      }
    }
    if (sort) filter.sort = sort as PropertyFilter['sort']

    const pagination: PropertyPagination = {
      page:     Math.max(1, parseInt(pageQ as string) || 1),
      pageSize: Math.max(1, parseInt(pageSizeQ as string) || 10),
    }

    if (authReq.user!.role === 'super_admin') {
      res.json(await service.listForSuperAdmin(filter, pagination))
    } else {
      filter.addedBy = authReq.user!.id
      res.json(await service.listForPropertyAdmin(filter, pagination))
    }
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    if (authReq.user!.role === 'super_admin') {
      res.json(await service.getByIdForSuperAdmin(req.params.id))
    } else {
      res.json(await service.getByIdForPropertyAdmin(req.params.id))
    }
  })

  // Task 6.1: createProperty — reads req.body as JSON, returns 201
  createProperty = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const property = await service.createProperty({ body: req.body, addedBy: authReq.user!.id })
    res.status(201).json(property)
  })

  // Task 6.2: updatePropertyData — replaces updateProperty, reads req.body as JSON, returns 200
  updatePropertyData = asyncHandler(async (req: Request, res: Response) => {
    const existing = req.property as unknown as IProperty
    const property = await service.updatePropertyData(req.params.id, { body: req.body, existing })
    res.json(property)
  })

  // Task 6.3: uploadImages — validates files present, calls service.uploadImages, returns 200
  uploadImages = asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as { [f: string]: Express.Multer.File[] })?.images ?? []
    if (files.length === 0) { res.status(400).json({ message: 'لم يتم إرسال أي صور' }); return }
    const existing = req.property as unknown as IProperty
    const property = await service.uploadImages(req.params.id, { imageFiles: files, existing })
    res.json(property)
  })

  // Task 6.4: replaceImages — parses optional existingImages, calls service.replaceImages, returns 200
  replaceImages = asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as { [f: string]: Express.Multer.File[] })?.images ?? []
    const existing = req.property as unknown as IProperty
    const existingImages = req.body.existingImages !== undefined
      ? JSON.parse(req.body.existingImages as string) as string[]
      : undefined
    const property = await service.replaceImages(req.params.id, { imageFiles: files, existingImages, existing })
    res.json(property)
  })

  // Task 6.5: uploadVideo — validates file present, calls service.uploadVideo, returns 200
  uploadVideo = asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as { [f: string]: Express.Multer.File[] })?.video ?? []
    if (files.length === 0) { res.status(400).json({ message: 'لم يتم إرسال أي فيديو' }); return }
    const existing = req.property as unknown as IProperty
    const property = await service.uploadVideo(req.params.id, { videoFile: files[0], existing })
    res.json(property)
  })

  // Task 6.6: replaceVideo — validates file present, calls service.replaceVideo, returns 200
  replaceVideo = asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as { [f: string]: Express.Multer.File[] })?.video ?? []
    if (files.length === 0) { res.status(400).json({ message: 'لم يتم إرسال أي فيديو' }); return }
    const existing = req.property as unknown as IProperty
    const property = await service.replaceVideo(req.params.id, { videoFile: files[0], existing })
    res.json(property)
  })

  // Task 6.7: removeVideo — calls service.removeVideo, returns 200
  removeVideo = asyncHandler(async (req: Request, res: Response) => {
    const existing = req.property as unknown as IProperty
    const property = await service.removeVideo(req.params.id, existing)
    res.json(property)
  })

  deleteProperty = asyncHandler(async (req: Request, res: Response) => {
    const existing = req.property as unknown as IProperty
    await service.delete(req.params.id, existing)
    res.status(200).json({ message: 'تم حذف العقار بنجاح' })
  })

  // Standalone upload — returns a Cloudinary URL without associating it with a property
  uploadMedia = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [f: string]: Express.Multer.File[] } | undefined
    const imageFile = files?.file?.[0]
    if (!imageFile) {
      res.status(400).json({ message: 'لم يتم إرسال أي ملف' })
      return
    }
    const isVideo = imageFile.fieldname === 'file' && imageFile.mimetype.startsWith('video/')
    const url = isVideo
      ? await uploadVideoToCloudinary(imageFile.buffer)
      : await uploadToCloudinary(imageFile.buffer, imageFile.mimetype)
    res.json({ url })
  })
}

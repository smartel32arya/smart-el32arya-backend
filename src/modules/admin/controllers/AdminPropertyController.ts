import { Request, Response } from 'express'
import { asyncHandler } from '../../../middleware/asyncHandler'
import { AdminPropertyService } from '../services/AdminPropertyService'
import { IProperty, PropertyFilter, PropertyPagination } from '../../../types/property.types'
import { AuthRequest } from '../../../types/express'

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

  createProperty = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const fields = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    const property = await service.create({
      body:       req.body as Record<string, string>,
      imageFiles: fields?.images ?? [],
      videoFiles: fields?.video  ?? [],
      addedBy:    authReq.user!.id,
    })

    res.status(201).json(property)
  })

  updateProperty = asyncHandler(async (req: Request, res: Response) => {
    const fields = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
    const existing = req.property as unknown as IProperty

    const property = await service.update(req.params.id, {
      body:       req.body as Record<string, string>,
      imageFiles: fields?.images ?? [],
      videoFiles: fields?.video  ?? [],
      existing,
    })

    res.json(property)
  })

  deleteProperty = asyncHandler(async (req: Request, res: Response) => {
    const existing = req.property as unknown as IProperty
    await service.delete(req.params.id, existing)
    res.status(200).json({ message: 'تم حذف العقار بنجاح' })
  })
}

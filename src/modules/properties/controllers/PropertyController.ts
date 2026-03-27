import { Request, Response } from 'express'
import { asyncHandler } from '../../../middleware/asyncHandler'
import { PropertyService } from '../services/PropertyService'
import { PropertyFilter, PropertyPagination } from '../../../types/property.types'

const service = new PropertyService()

export class PropertyController {
  getFeatured = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 6
    res.json(await service.getFeatured(limit))
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.getById(req.params.id))
  })

  listProperties = asyncHandler(async (req: Request, res: Response) => {
    const { neighborhood, type, priceRange, sort, page: pageQ, pageSize: pageSizeQ, isActive } = req.query

    const filter: PropertyFilter = {}

    if (isActive === 'true')       filter.active = true
    else if (isActive === 'false') filter.active = false
    else                           filter.active = true // default: only show active properties

    if (neighborhood) filter.neighborhood = neighborhood as string
    if (type)         filter.type = type as string

    if (priceRange && priceRange !== 'all') {
      const parts = (priceRange as string).split('-')
      if (parts.length === 2) {
        const min = parseFloat(parts[0])
        const max = parseFloat(parts[1])
        if (!isNaN(min) && !isNaN(max)) {
          filter.priceMin = min
          filter.priceMax = max
        }
      }
    }

    if (sort) filter.sort = sort as PropertyFilter['sort']

    const pagination: PropertyPagination = {
      page:     Math.max(1, parseInt(pageQ as string) || 1),
      pageSize: Math.max(1, parseInt(pageSizeQ as string) || 10),
    }

    res.json(await service.listProperties(filter, pagination))
  })
}

import { Router, Request, Response } from 'express'
import Property from '../models/Property'

export const propertiesRouter = Router()

// GET /featured — must be before /:id
propertiesRouter.get('/featured', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 6
    const properties = await Property.find({ featured: true, active: true }).limit(limit)
    res.json(properties)
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ في الخادم' })
  }
})

// GET /:id
propertiesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const property = await Property.findOne({ id: req.params.id })
    if (!property) {
      return res.status(404).json({ message: 'العقار غير موجود' })
    }
    res.json(property)
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ في الخادم' })
  }
})

// GET /
propertiesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { neighborhood, type, priceRange, sort, page: pageQ, pageSize: pageSizeQ, isActive } = req.query

    const filter: Record<string, unknown> = {}
    if (isActive === 'true') {
      filter.active = true
    } else if (isActive === 'false') {
      filter.active = false
    }

    if (neighborhood) filter.neighborhood = neighborhood
    if (type) filter.type = type

    if (priceRange && priceRange !== 'all') {
      const parts = (priceRange as string).split('-')
      if (parts.length === 2) {
        const min = parseFloat(parts[0])
        const max = parseFloat(parts[1])
        if (!isNaN(min) && !isNaN(max)) {
          filter.price = { $gte: min, $lte: max }
        }
      }
    }

    const sortMap: Record<string, [string, 1 | -1][]> = {
      newest: [['createdAt', -1]],
      'price-asc': [['price', 1]],
      'price-desc': [['price', -1]],
      'area-desc': [['area', -1]],
    }
    const sortOrder = sortMap[(sort as string)] || sortMap['newest']

    const page = Math.max(1, parseInt(pageQ as string) || 1)
    const pageSize = Math.max(1, parseInt(pageSizeQ as string) || 10)
    const skip = (page - 1) * pageSize

    const [data, total] = await Promise.all([
      Property.find(filter).sort(sortOrder).skip(skip).limit(pageSize),
      Property.countDocuments(filter),
    ])

    res.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ في الخادم' })
  }
})

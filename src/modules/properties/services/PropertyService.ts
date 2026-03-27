import PropertyModel from '../../../models/Property'
import { AppError } from '../../../errors/AppError'
import { formatPrice } from '../../../utils/formatPrice'
import { SortOrder, Types } from 'mongoose'
import {
  IProperty,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyFilter,
  PropertyPagination,
  PropertyListResult,
  PropertyWithContact,
  PropertyAdminView,
} from '../../../types/property.types'

// Populate factory — called per-request so `new Date()` is always fresh
function activeUserPopulate() {
  return {
    path: 'addedBy',
    select: '_id name phone active expiresAt role',
    match: {
      active: true,
      $or: [
        { role: 'super_admin' },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    },
  }
}

// Populate for admin routes — all owners regardless of status
const ALL_USER_POPULATE = {
  path: 'addedBy',
  select: '_id name phone active expiresAt role',
}

type PopulatedUser = { _id: string; name: string; phone: string; active: boolean; expiresAt: Date | null; role: string } | null

function isOwnerSuspended(owner: PopulatedUser): boolean {
  if (!owner) return true
  if (!owner.active) return true
  if (owner.role === 'super_admin') return false
  if (!owner.expiresAt) return true
  return new Date(owner.expiresAt) < new Date()
}

function toContact(doc: IProperty & { addedBy: PopulatedUser }): PropertyWithContact {
  return {
    ...doc,
    addedBy: doc.addedBy?.name ?? 'Unknown',
    contactPhone: doc.addedBy?.phone ?? null,
  }
}

function toAdminView(doc: IProperty & { addedBy: PopulatedUser }): PropertyAdminView {
  return {
    ...doc,
    addedBy: doc.addedBy?.name ?? 'Unknown',
    contactPhone: doc.addedBy?.phone ?? null,
    ownerSuspended: isOwnerSuspended(doc.addedBy),
    ownerActive: doc.addedBy?.active ?? false,
  }
}

export class PropertyService {
  async listProperties(
    filter: PropertyFilter,
    pagination: PropertyPagination,
  ): Promise<PropertyListResult> {
    const query: Record<string, unknown> = {}
    if (filter.active !== undefined) query.active = filter.active
    if (filter.neighborhood)        query.neighborhood = filter.neighborhood
    if (filter.type)                query.type = filter.type
    if (filter.addedBy)             query.addedBy = filter.addedBy
    if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
      query.price = {}
      if (filter.priceMin !== undefined) (query.price as Record<string, number>).$gte = filter.priceMin
      if (filter.priceMax !== undefined) (query.price as Record<string, number>).$lte = filter.priceMax
    }

    const sortMap: Record<string, Record<string, SortOrder>> = {
      newest:       { createdAt: -1 },
      'price-asc':  { price: 1 },
      'price-desc': { price: -1 },
      'area-desc':  { area: -1 },
    }
    const sort: Record<string, SortOrder> = filter.sort ? sortMap[filter.sort] : { createdAt: -1 }
    const skip = (pagination.page - 1) * pagination.pageSize
    const now = new Date()

    // Use aggregation to accurately count and paginate after joining with active users.
    // $lookup + $match ensures total reflects only properties with active owners.
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'addedBy',
          foreignField: '_id',
          as: 'owner',
        },
      },
      { $unwind: '$owner' },
      {
        $match: {
          'owner.active': true,
          $or: [
            { 'owner.role': 'super_admin' },
            { 'owner.expiresAt': null },
            { 'owner.expiresAt': { $gt: now } },
          ],
        },
      },
      {
        $facet: {
          data: [
            { $sort: sort },
            { $skip: skip },
            { $limit: pagination.pageSize },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ]

    const [result] = await PropertyModel.aggregate(pipeline as import('mongoose').PipelineStage[])
    const docs = (result?.data ?? []) as (IProperty & { owner: PopulatedUser })[]
    const total: number = result?.count?.[0]?.total ?? 0

    const data = docs.map((d) => ({
      ...d,
      addedBy: (d.owner as unknown as { name: string })?.name ?? 'Unknown',
      contactPhone: (d.owner as unknown as { phone: string } | null)?.phone ?? null,
    })) as PropertyWithContact[]

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async getFeatured(limit: number): Promise<PropertyWithContact[]> {
    const docs = await PropertyModel
      .find({ active: true, featured: true })
      .limit(limit)
      .populate(activeUserPopulate())
      .lean()

    return (docs as unknown as (IProperty & { addedBy: PopulatedUser })[])
      .filter((d) => d.addedBy !== null)
      .map(toContact)
  }

  async getById(id: string): Promise<PropertyWithContact> {
    const doc = await PropertyModel
      .findById(id)
      .populate(activeUserPopulate())
      .lean()

    if (!doc) throw new AppError(404, 'العقار غير موجود')

    const populated = doc as unknown as IProperty & { addedBy: PopulatedUser }
    if (!populated.addedBy) throw new AppError(404, 'العقار غير موجود')

    return toContact(populated)
  }

  // ── Admin-only methods (super_admin sees all, including suspended owners) ──

  async listPropertiesAdmin(
    filter: PropertyFilter,
    pagination: PropertyPagination,
  ): Promise<{ data: PropertyAdminView[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const query: Record<string, unknown> = {}
    if (filter.active !== undefined) query.active = filter.active
    if (filter.neighborhood)        query.neighborhood = filter.neighborhood
    if (filter.type)                query.type = filter.type
    if (filter.addedBy)             query.addedBy = filter.addedBy
    if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
      query.price = {}
      if (filter.priceMin !== undefined) (query.price as Record<string, number>).$gte = filter.priceMin
      if (filter.priceMax !== undefined) (query.price as Record<string, number>).$lte = filter.priceMax
    }

    const sortMap: Record<string, Record<string, SortOrder>> = {
      newest:       { createdAt: -1 },
      'price-asc':  { price: 1 },
      'price-desc': { price: -1 },
      'area-desc':  { area: -1 },
    }
    const sort: Record<string, SortOrder> = filter.sort ? sortMap[filter.sort] : { createdAt: -1 }
    const skip = (pagination.page - 1) * pagination.pageSize

    const [docs, total] = await Promise.all([
      PropertyModel.find(query).sort(sort).skip(skip).limit(pagination.pageSize)
        .populate(ALL_USER_POPULATE).lean(),
      PropertyModel.countDocuments(query),
    ])

    return {
      data: (docs as unknown as (IProperty & { addedBy: PopulatedUser })[]).map(toAdminView),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async getByIdAdmin(id: string): Promise<PropertyAdminView> {
    const doc = await PropertyModel.findById(id).populate(ALL_USER_POPULATE).lean()
    if (!doc) throw new AppError(404, 'العقار غير موجود')
    return toAdminView(doc as unknown as IProperty & { addedBy: PopulatedUser })
  }

  async createProperty(dto: CreatePropertyDto): Promise<IProperty> {
    const doc = new PropertyModel({ ...dto, priceFormatted: formatPrice(dto.price) })
    await doc.save()
    return doc.toObject() as unknown as IProperty
  }

  async updateProperty(id: string, dto: UpdatePropertyDto): Promise<IProperty> {
    const doc = await PropertyModel.findById(id)
    if (!doc) throw new AppError(404, 'العقار غير موجود')
    Object.assign(doc, dto)
    if (dto.price !== undefined) doc.priceFormatted = formatPrice(dto.price)
    await doc.save()
    return doc.toObject() as unknown as IProperty
  }

  async deleteProperty(id: string): Promise<void> {
    const doc = await PropertyModel.findByIdAndDelete(id)
    if (!doc) throw new AppError(404, 'العقار غير موجود')
  }
}

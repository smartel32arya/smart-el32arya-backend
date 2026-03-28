// Set JWT_SECRET before any module imports that depend on it
process.env.JWT_SECRET = 'test-secret'

import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { adminPropertiesRouter } from '../modules/admin/routes/adminProperties.routes'
import { adminUsersRouter } from '../modules/admin/routes/adminUsers.routes'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin'
import Property from '../models/Property'
import User from '../models/User'
import { AuthRequest, JwtPayload } from '../types/express'
import { Request, Response, NextFunction } from 'express'

// Stub authenticate: verify JWT and attach user to req (no DB lookup)
function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'رأس التفويض مفقود أو غير صالح' })
    return
  }
  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, 'test-secret') as JwtPayload
    ;(req as AuthRequest).user = payload
    next()
  } catch {
    res.status(401).json({ message: 'الرمز غير صالح أو منتهي الصلاحية' })
  }
}

// Minimal test app
const app = express()
app.use(express.json())
app.use('/api/admin/properties', authenticate, adminPropertiesRouter)
app.use('/api/admin/users', authenticate, requireSuperAdmin, adminUsersRouter)

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Property.deleteMany({})
  await User.deleteMany({})
})

// Helper: generate a valid JWT token
function generateToken(role: 'super_admin' | 'property_admin', id = new mongoose.Types.ObjectId().toHexString()) {
  return jwt.sign(
    { id, username: `${role}_user`, role, name: 'Test User' },
    'test-secret',
    { expiresIn: '1h' }
  )
}

// Helper: create a minimal valid property body
function propertyBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Property',
    description: 'A test property description',
    price: 1500000,
    location: 'المنيا الجديدة',
    neighborhood: 'حي الزهراء',
    type: 'شقة',
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    featured: false,
    active: true,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 14: super_admin guard returns 403 for property_admin
// ─────────────────────────────────────────────────────────────────────────────

test('Property 14: GET /api/admin/users with property_admin token → 403', async () => {
  const token = generateToken('property_admin')
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(403)
  expect(res.body).toHaveProperty('message')
})

test('Property 14: POST /api/admin/users with property_admin token → 403', async () => {
  const token = generateToken('property_admin')
  const res = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New User', username: 'new_user', password: 'pass123', role: 'property_admin' })
  expect(res.status).toBe(403)
  expect(res.body).toHaveProperty('message')
})

test('Property 14: PUT /api/admin/users/:id with property_admin token → 403', async () => {
  const token = generateToken('property_admin')
  const res = await request(app)
    .put('/api/admin/users/some-id')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Updated' })
  expect(res.status).toBe(403)
  expect(res.body).toHaveProperty('message')
})

test('Property 14: DELETE /api/admin/users/:id with property_admin token → 403', async () => {
  const token = generateToken('property_admin')
  const res = await request(app)
    .delete('/api/admin/users/some-id')
    .set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(403)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 15: No password in admin user responses
// ─────────────────────────────────────────────────────────────────────────────

test('Property 15: GET /api/admin/users response should not contain password fields', async () => {
  // Create a user directly in DB
  await User.create({
    name: 'Admin User',
    username: 'admin_user',
    password: 'hashed-password',
    phone: '01000000000',
    role: 'super_admin',
    active: true,
  })

  const token = generateToken('super_admin')
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
  for (const user of res.body) {
    expect(user).not.toHaveProperty('password')
  }
  expect(JSON.stringify(res.body)).not.toMatch(/"password"/)
})

test('Property 15: POST /api/admin/users response should not contain password field', async () => {
  const token = generateToken('super_admin')
  const res = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New Admin', username: 'newadmin_user', phone: '01012345678', password: 'secret123', role: 'property_admin' })

  expect(res.status).toBe(201)
  expect(res.body).not.toHaveProperty('password')
  expect(JSON.stringify(res.body)).not.toMatch(/"password"/)
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 19: Duplicate username returns 409
// ─────────────────────────────────────────────────────────────────────────────

test('Property 19: POST /api/admin/users with duplicate username → 409', async () => {
  const token = generateToken('super_admin')

  // Create first user
  await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'First User', username: 'dup_user', phone: '01012345678', password: 'pass123', role: 'property_admin' })

  // Attempt duplicate
  const res = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Second User', username: 'dup_user', phone: '01012345678', password: 'pass456', role: 'property_admin' })

  expect(res.status).toBe(409)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit examples — Admin Properties CRUD
// ─────────────────────────────────────────────────────────────────────────────

test('POST /api/admin/properties (JSON) → 201 with created property', async () => {
  const token = generateToken('property_admin')

  const res = await request(app)
    .post('/api/admin/properties')
    .set('Authorization', `Bearer ${token}`)
    .send(propertyBody())

  expect(res.status).toBe(201)
  expect(res.body).toHaveProperty('_id')
  expect(res.body.title).toBe(propertyBody().title)
  expect(res.body.price).toBe(propertyBody().price)
})

test('PUT /api/admin/properties/:id → 200 with updated property', async () => {
  const userId = new mongoose.Types.ObjectId().toHexString()
  const token = generateToken('property_admin', userId)

  // Create a property owned by the same user as the token
  const property = await Property.create({ ...propertyBody(), addedBy: userId })

  const res = await request(app)
    .put(`/api/admin/properties/${property._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Updated Title' })

  expect(res.status).toBe(200)
  expect(res.body.title).toBe('Updated Title')
})

test('DELETE /api/admin/properties/:id → 200', async () => {
  const userId = new mongoose.Types.ObjectId().toHexString()
  const token = generateToken('property_admin', userId)

  const property = await Property.create({ ...propertyBody(), addedBy: userId })

  const res = await request(app)
    .delete(`/api/admin/properties/${property._id}`)
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('message')
})

test('PUT /api/admin/properties/nonexistent → 404', async () => {
  const token = generateToken('property_admin')

  const res = await request(app)
    .put('/api/admin/properties/nonexistent-id')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Ghost' })

  expect(res.status).toBe(404)
  expect(res.body).toHaveProperty('message')
})

test('DELETE /api/admin/properties/nonexistent → 404', async () => {
  const token = generateToken('property_admin')

  const res = await request(app)
    .delete('/api/admin/properties/nonexistent-id')
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(404)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit examples — Admin Users CRUD
// ─────────────────────────────────────────────────────────────────────────────

test('GET /api/admin/users → 200 with array', async () => {
  const token = generateToken('super_admin')

  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})

test('POST /api/admin/users → 201 with created user', async () => {
  const token = generateToken('super_admin')

  const res = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New User', username: 'newuser_user', phone: '01012345678', password: 'pass123', role: 'property_admin' })

  expect(res.status).toBe(201)
  expect(res.body).toHaveProperty('_id')
  expect(res.body.username).toBe('newuser_user')
  expect(res.body.role).toBe('property_admin')
})

test('PUT /api/admin/users/:id → 200 with updated user', async () => {
  const token = generateToken('super_admin')

  // Create user first
  const createRes = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Original Name', username: 'update_user', phone: '01012345678', password: 'pass123', role: 'property_admin' })

  expect(createRes.status).toBe(201)
  const userId = createRes.body._id

  const res = await request(app)
    .put(`/api/admin/users/${userId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Updated Name' })

  expect(res.status).toBe(200)
  expect(res.body.name).toBe('Updated Name')
})

test('DELETE /api/admin/users/:id → 200', async () => {
  const token = generateToken('super_admin')

  const createRes = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'To Delete', username: 'delete_user', phone: '01012345678', password: 'pass123', role: 'property_admin' })

  expect(createRes.status).toBe(201)
  const userId = createRes.body._id

  const res = await request(app)
    .delete(`/api/admin/users/${userId}`)
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('message')
})

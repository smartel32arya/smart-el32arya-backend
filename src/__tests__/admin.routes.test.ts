// Set JWT_SECRET before any module imports that depend on it
process.env.JWT_SECRET = 'test-secret'

import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { adminPropertiesRouter } from '../routes/admin/properties'
import { adminUsersRouter } from '../routes/admin/users'
import { authenticate } from '../middleware/authenticate'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin'
import Property from '../models/Property'
import User from '../models/User'

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
function generateToken(role: 'super_admin' | 'property_admin', id = 'test-user-id') {
  return jwt.sign(
    { id, email: `${role}@example.com`, role, name: 'Test User' },
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
    .send({ name: 'New User', email: 'new@example.com', password: 'pass123', role: 'property_admin' })
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
    email: 'admin@example.com',
    password: 'hashed-password',
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
    .send({ name: 'New Admin', email: 'newadmin@example.com', password: 'secret123', role: 'property_admin' })

  expect(res.status).toBe(201)
  expect(res.body).not.toHaveProperty('password')
  expect(JSON.stringify(res.body)).not.toMatch(/"password"/)
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 19: Duplicate email returns 409
// ─────────────────────────────────────────────────────────────────────────────

test('Property 19: POST /api/admin/users with duplicate email → 409', async () => {
  const token = generateToken('super_admin')

  // Create first user
  await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'First User', email: 'dup@example.com', password: 'pass123', role: 'property_admin' })

  // Attempt duplicate
  const res = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Second User', email: 'dup@example.com', password: 'pass456', role: 'property_admin' })

  expect(res.status).toBe(409)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit examples — Admin Properties CRUD
// ─────────────────────────────────────────────────────────────────────────────

test('POST /api/admin/properties (form fields) → 201 with created property', async () => {
  const token = generateToken('property_admin')
  const body = propertyBody()

  const res = await request(app)
    .post('/api/admin/properties')
    .set('Authorization', `Bearer ${token}`)
    .field('title', body.title as string)
    .field('description', body.description as string)
    .field('price', String(body.price))
    .field('location', body.location as string)
    .field('neighborhood', body.neighborhood as string)
    .field('type', body.type as string)
    .field('bedrooms', String(body.bedrooms))
    .field('bathrooms', String(body.bathrooms))
    .field('area', String(body.area))
    .field('featured', 'false')
    .field('active', 'true')

  expect(res.status).toBe(201)
  expect(res.body).toHaveProperty('id')
  expect(res.body.title).toBe(body.title)
  expect(res.body.price).toBe(body.price)
})

test('PUT /api/admin/properties/:id → 200 with updated property', async () => {
  const token = generateToken('property_admin')

  // Create a property first
  const property = await Property.create(propertyBody())

  const res = await request(app)
    .put(`/api/admin/properties/${property.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Updated Title' })

  expect(res.status).toBe(200)
  expect(res.body.title).toBe('Updated Title')
})

test('DELETE /api/admin/properties/:id → 200', async () => {
  const token = generateToken('property_admin')

  const property = await Property.create(propertyBody())

  const res = await request(app)
    .delete(`/api/admin/properties/${property.id}`)
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
    .send({ name: 'New User', email: 'newuser@example.com', password: 'pass123', role: 'property_admin' })

  expect(res.status).toBe(201)
  expect(res.body).toHaveProperty('id')
  expect(res.body.email).toBe('newuser@example.com')
  expect(res.body.role).toBe('property_admin')
})

test('PUT /api/admin/users/:id → 200 with updated user', async () => {
  const token = generateToken('super_admin')

  // Create user first
  const createRes = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Original Name', email: 'update@example.com', password: 'pass123', role: 'property_admin' })

  expect(createRes.status).toBe(201)
  const userId = createRes.body.id

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
    .send({ name: 'To Delete', email: 'delete@example.com', password: 'pass123', role: 'property_admin' })

  expect(createRes.status).toBe(201)
  const userId = createRes.body.id

  const res = await request(app)
    .delete(`/api/admin/users/${userId}`)
    .set('Authorization', `Bearer ${token}`)

  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('message')
})

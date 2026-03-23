// Set JWT_SECRET before any module imports that depend on it
process.env.JWT_SECRET = 'test-secret'

import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { authRouter } from '../routes/auth'
import { authenticate } from '../middleware/authenticate'
import User from '../models/User'

// Minimal test app — no connectDB, no listen
const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)

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
  await User.deleteMany({})
})

// Helper: create a user with a bcrypt-hashed password
async function createTestUser(overrides: Partial<{
  name: string
  email: string
  password: string
  role: 'super_admin' | 'property_admin'
  active: boolean
}> = {}) {
  const plainPassword = overrides.password ?? 'password123'
  const hashedPassword = await bcrypt.hash(plainPassword, 10)
  return User.create({
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? 'test@example.com',
    password: hashedPassword,
    role: overrides.role ?? 'property_admin',
    active: overrides.active !== undefined ? overrides.active : true,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 12: Protected routes return 401 without valid JWT
// ─────────────────────────────────────────────────────────────────────────────

test('Property 12: GET /api/auth/me without Authorization header → 401', async () => {
  const res = await request(app).get('/api/auth/me')
  expect(res.status).toBe(401)
  expect(res.body).toHaveProperty('message')
})

test('Property 12: GET /api/auth/me with malformed token → 401', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer not.a.valid.token')
  expect(res.status).toBe(401)
  expect(res.body).toHaveProperty('message')
})

test('Property 12: GET /api/auth/me with expired token → 401', async () => {
  const expiredToken = jwt.sign(
    { id: 'some-id', email: 'test@example.com', role: 'property_admin', name: 'Test' },
    'test-secret',
    { expiresIn: '0s' }
  )
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${expiredToken}`)
  expect(res.status).toBe(401)
  expect(res.body).toHaveProperty('message')
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 13: authenticate middleware attaches user to req
// ─────────────────────────────────────────────────────────────────────────────

test('Property 13: POST /api/auth/login with valid credentials → returns token', async () => {
  await createTestUser({ email: 'admin@example.com', password: 'secret123' })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'secret123' })

  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('token')
  expect(typeof res.body.token).toBe('string')
})

test('Property 13: GET /api/auth/me with valid token → returns user object with id, email, role, name', async () => {
  await createTestUser({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'mypassword',
    role: 'super_admin',
  })

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'jane@example.com', password: 'mypassword' })

  expect(loginRes.status).toBe(200)
  const { token } = loginRes.body

  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`)

  expect(meRes.status).toBe(200)
  expect(meRes.body).toHaveProperty('id')
  expect(meRes.body).toHaveProperty('email', 'jane@example.com')
  expect(meRes.body).toHaveProperty('role', 'super_admin')
  expect(meRes.body).toHaveProperty('name', 'Jane Doe')
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: smart-realestate-backend, Property 15: No password in response
// ─────────────────────────────────────────────────────────────────────────────

test('Property 15: POST /api/auth/login response body should not contain password field', async () => {
  await createTestUser({ email: 'user@example.com', password: 'pass123' })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@example.com', password: 'pass123' })

  expect(res.status).toBe(200)
  expect(res.body.user).not.toHaveProperty('password')
  // Also check nested stringified body
  expect(JSON.stringify(res.body)).not.toMatch(/"password"/)
})

test('Property 15: GET /api/auth/me response body should not contain password field', async () => {
  await createTestUser({ email: 'user2@example.com', password: 'pass456' })

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user2@example.com', password: 'pass456' })

  const { token } = loginRes.body

  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`)

  expect(meRes.status).toBe(200)
  expect(meRes.body).not.toHaveProperty('password')
  expect(JSON.stringify(meRes.body)).not.toMatch(/"password"/)
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit examples — login error cases
// ─────────────────────────────────────────────────────────────────────────────

test('POST /api/auth/login with non-existent email → 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'nobody@example.com', password: 'whatever' })

  expect(res.status).toBe(401)
  expect(res.body).toHaveProperty('message')
})

test('POST /api/auth/login with wrong password → 401', async () => {
  await createTestUser({ email: 'real@example.com', password: 'correctpass' })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'real@example.com', password: 'wrongpass' })

  expect(res.status).toBe(401)
  expect(res.body).toHaveProperty('message')
})

test('POST /api/auth/login with inactive user → 403', async () => {
  await createTestUser({ email: 'inactive@example.com', password: 'pass123', active: false })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'inactive@example.com', password: 'pass123' })

  expect(res.status).toBe(403)
  expect(res.body).toHaveProperty('message')
})

test('POST /api/auth/login with valid credentials → 200 with { token, user }', async () => {
  await createTestUser({
    name: 'Valid User',
    email: 'valid@example.com',
    password: 'validpass',
    role: 'property_admin',
  })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'valid@example.com', password: 'validpass' })

  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('token')
  expect(res.body).toHaveProperty('user')
  expect(res.body.user).toHaveProperty('id')
  expect(res.body.user).toHaveProperty('email', 'valid@example.com')
  expect(res.body.user).toHaveProperty('role', 'property_admin')
  expect(res.body.user).toHaveProperty('name', 'Valid User')
})

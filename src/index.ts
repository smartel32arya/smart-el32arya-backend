import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { config } from './config'
import { connectDB } from './db'
import { errorHandler } from './middleware/errorHandler'
import { authenticate } from './middleware/authenticate'
import { propertiesRouter } from './modules/properties/routes/properties.routes'
import { authRouter } from './modules/auth/routes/auth.routes'
import { usersRouter } from './modules/users/routes/users.routes'
import { adminPropertiesRouter } from './modules/admin/routes/adminProperties.routes'
import { adminUsersRouter } from './modules/admin/routes/adminUsers.routes'

// ─── App factory ─────────────────────────────────────────────────────────────

function createApp(): express.Application {
  const app = express()

  // Global middleware
  app.use(helmet())
  app.use(morgan('dev'))
  app.use(cors())
  app.use(express.json())

  // Ensure DB is connected before any route handler runs
  app.use(async (_req, _res, next) => {
    await connectDB()
    next()
  })

  // Routes
  app.use('/api/properties',       propertiesRouter)
  app.use('/api/auth',             authRouter)
  app.use('/api/users',            usersRouter)
  app.use('/api/admin/properties', authenticate, adminPropertiesRouter)
  app.use('/api/admin/users',      authenticate, adminUsersRouter)

  // Global error handler — must be last
  app.use(errorHandler)

  return app
}

// ─── Exports (Vercel + tests use the app directly) ───────────────────────────

export const app = createApp()
export default app

// ─── Local server ─────────────────────────────────────────────────────────────

if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`)
    })
  })
}

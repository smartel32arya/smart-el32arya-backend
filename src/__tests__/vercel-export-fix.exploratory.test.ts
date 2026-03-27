/**
 * EXPLORATORY TESTS — Expected to FAIL on unfixed code.
 * Failure confirms the bug exists as described in the bugfix spec.
 *
 * Bug: src/index.ts is incompatible with Vercel's @vercel/node runtime because:
 *   1. It uses a named export (`export { app }`) instead of a default export.
 *   2. It unconditionally calls `app.listen()` inside a `connectDB().then(...)` callback.
 *
 * Validates: Requirements 1.1, 1.2 (bug condition confirmation)
 */

// Mock ../db to prevent real DB connections when index.ts is imported
jest.mock('../db', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

// Mock ../config to avoid dotenv/env issues
jest.mock('../config', () => ({
  PORT: 5000,
  MONGODB_URI: 'mongodb://localhost:27017/test',
  JWT_SECRET: 'test-secret',
}));

// Mock all route modules to keep the import lightweight
jest.mock('../modules/properties/routes', () => ({ propertiesRouter: require('express').Router() }));
jest.mock('../modules/auth/routes', () => ({ authRouter: require('express').Router() }));
jest.mock('../modules/admin/routes/properties', () => ({ adminPropertiesRouter: require('express').Router() }));
jest.mock('../modules/admin/routes/users', () => ({ adminUsersRouter: require('express').Router() }));
jest.mock('../middleware/authenticate', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

describe('Exploratory: vercel-export-fix bug conditions (expected to FAIL on unfixed code)', () => {
  /**
   * Task 1.1 — Default Export Test
   *
   * EXPECTED TO FAIL on unfixed code: src/index.ts only has `export { app }` (named export).
   * There is no `export default app`, so `module.default` will be undefined.
   *
   * Validates: Requirements 1.1, 2.1
   */
  it('1.1 [EXPLORATORY] src/index.ts should have a default export that is the Express app', () => {
    jest.resetModules();

    // Re-apply mocks after resetModules
    jest.mock('../db', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.mock('../config', () => ({ PORT: 5000, MONGODB_URI: 'mongodb://localhost:27017/test', JWT_SECRET: 'test-secret' }));
    jest.mock('../modules/properties/routes', () => ({ propertiesRouter: require('express').Router() }));
    jest.mock('../modules/auth/routes', () => ({ authRouter: require('express').Router() }));
    jest.mock('../modules/admin/routes/properties', () => ({ adminPropertiesRouter: require('express').Router() }));
    jest.mock('../modules/admin/routes/users', () => ({ adminUsersRouter: require('express').Router() }));
    jest.mock('../middleware/authenticate', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

    const indexModule = require('../index');

    // The default export should be the Express app (a function)
    expect(typeof indexModule.default).toBe('function');
    expect(indexModule.default).toBeDefined();
  });

  /**
   * Task 1.2 — No Unconditional Listen Test
   *
   * EXPECTED TO FAIL on unfixed code: `connectDB().then(() => app.listen(...))` is called
   * unconditionally regardless of `process.env.VERCEL`.
   *
   * Validates: Requirements 1.2, 2.2
   */
  it('1.2 [EXPLORATORY] app.listen should NOT be called when process.env.VERCEL is set', async () => {
    jest.resetModules();

    // Set VERCEL env var to simulate Vercel's serverless runtime
    process.env.VERCEL = '1';

    const listenMock = jest.fn();

    // Re-apply mocks after resetModules
    jest.mock('../db', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.mock('../config', () => ({ PORT: 5000, MONGODB_URI: 'mongodb://localhost:27017/test', JWT_SECRET: 'test-secret' }));
    jest.mock('../modules/properties/routes', () => ({ propertiesRouter: require('express').Router() }));
    jest.mock('../modules/auth/routes', () => ({ authRouter: require('express').Router() }));
    jest.mock('../modules/admin/routes/properties', () => ({ adminPropertiesRouter: require('express').Router() }));
    jest.mock('../modules/admin/routes/users', () => ({ adminUsersRouter: require('express').Router() }));
    jest.mock('../middleware/authenticate', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

    // Mock express so we can spy on listen
    jest.mock('express', () => {
      const actualExpress = jest.requireActual('express');
      const mockApp = actualExpress();
      mockApp.listen = listenMock;
      const factory = () => mockApp;
      // Copy over express properties (Router, json, etc.)
      Object.assign(factory, actualExpress);
      return factory;
    });

    require('../index');

    // Allow any pending promises (connectDB().then(...)) to resolve
    await new Promise((resolve) => setImmediate(resolve));

    try {
      // On unfixed code, listen WILL have been called — this assertion will fail
      expect(listenMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.VERCEL;
    }
  });
});

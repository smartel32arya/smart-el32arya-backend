import express, { RequestHandler, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PORT } from './config';
import { connectDB } from './db';
import { propertiesRouter } from './routes/properties';
import { authRouter } from './routes/auth';
import { adminPropertiesRouter } from './routes/admin/properties';
import { adminUsersRouter } from './routes/admin/users';
import { authenticate } from './middleware/authenticate';

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

app.use('/api/properties', propertiesRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin/properties', authenticate as RequestHandler, adminPropertiesRouter);
app.use('/api/admin/users', adminUsersRouter);

// Global error logger
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.message}`);
  res.status(500).json({ error: err.message });
});

if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

export { app };
export default app;

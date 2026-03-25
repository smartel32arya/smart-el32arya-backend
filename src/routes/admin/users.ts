import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import User from '../../models/User'
import { authenticate } from '../../middleware/authenticate'
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin'
import { AuthRequest } from '../../types/express'

export const adminUsersRouter = Router()

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const usernameRegex = /^[a-zA-Z0-9_]+$/

const createUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  username: z
    .string()
    .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    .regex(usernameRegex, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  role: z.enum(['super_admin', 'property_admin']),
  active: z.boolean().optional().default(true),
})

const updateUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').optional(),
  username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل').regex(usernameRegex, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط').optional(),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').optional(),
  role: z.enum(['super_admin', 'property_admin']).optional(),
  active: z.boolean().optional(),
})

// ── GET / — متاح لـ super_admin و property_admin ─────────────────────────────

adminUsersRouter.get(
  '/',
  authenticate as any,
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const users = await User.find()
      res.json(users.map((u) => u.toJSON()))
    } catch {
      res.status(500).json({ message: 'حدث خطأ أثناء جلب المستخدمين' })
    }
  }
)

// ── POST / — super_admin فقط ──────────────────────────────────────────────────

adminUsersRouter.post(
  '/',
  authenticate as any,
  requireSuperAdmin as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0].message })
      return
    }

    const { name, username, password, role, active } = parsed.data

    try {
      const existing = await User.findOne({ username })
      if (existing) {
        res.status(400).json({ message: 'اسم المستخدم مستخدم بالفعل' })
        return
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const user = new User({ name, username, password: hashedPassword, role, active })
      await user.save()

      res.status(201).json(user.toJSON())
    } catch {
      res.status(500).json({ message: 'حدث خطأ أثناء إنشاء المستخدم' })
    }
  }
)

// ── PUT /:id — super_admin فقط ───────────────────────────────────────────────

adminUsersRouter.put(
  '/:id',
  authenticate as any,
  requireSuperAdmin as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0].message })
      return
    }

    const updates: Record<string, unknown> = { ...parsed.data }

    try {
      if (updates.username) {
        const existing = await User.findOne({ username: updates.username, id: { $ne: req.params.id } })
        if (existing) {
          res.status(400).json({ message: 'اسم المستخدم مستخدم بالفعل' })
          return
        }
      }

      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password as string, 10)
      }

      const user = await User.findOneAndUpdate(
        { id: req.params.id },
        updates,
        { new: true, runValidators: true }
      )

      if (!user) {
        res.status(404).json({ message: 'المستخدم غير موجود' })
        return
      }

      res.json(user.toJSON())
    } catch {
      res.status(500).json({ message: 'حدث خطأ أثناء تعديل المستخدم' })
    }
  }
)

// ── DELETE /:id — super_admin فقط ────────────────────────────────────────────

adminUsersRouter.delete(
  '/:id',
  authenticate as any,
  requireSuperAdmin as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.params.id === req.user!.id) {
        res.status(403).json({ message: 'لا يمكنك حذف حسابك الخاص' })
        return
      }

      const user = await User.findOneAndDelete({ id: req.params.id })

      if (!user) {
        res.status(404).json({ message: 'المستخدم غير موجود' })
        return
      }

      res.json({ message: 'تم حذف المستخدم بنجاح' })
    } catch {
      res.status(500).json({ message: 'حدث خطأ أثناء حذف المستخدم' })
    }
  }
)

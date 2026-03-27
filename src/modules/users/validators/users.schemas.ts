import { z } from 'zod'

const usernameRegex = /^[a-zA-Z0-9_]+$/

// Egyptian WhatsApp numbers: 01[0125]XXXXXXXX or +201[0125]XXXXXXXX or 201[0125]XXXXXXXX
const egyptianPhoneRegex = /^(\+?2)?01[0125][0-9]{8}$/

export const createUserSchema = z.object({
  name: z
    .string({ error: 'الاسم مطلوب' })
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  username: z
    .string({ error: 'اسم المستخدم مطلوب' })
    .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    .regex(usernameRegex, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط'),
  phone: z
    .string({ error: 'رقم الواتساب مطلوب' })
    .regex(egyptianPhoneRegex, 'رقم الواتساب يجب أن يكون رقماً مصرياً صالحاً (مثال: 01012345678)'),
  password: z
    .string({ error: 'كلمة المرور مطلوبة' })
    .min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  role: z.enum(['super_admin', 'property_admin'], {
    error: 'الدور يجب أن يكون super_admin أو property_admin',
  }),
  active: z.boolean().optional().default(true),
  expiresAt: z.coerce.date({ error: 'تاريخ انتهاء الصلاحية غير صالح' }).nullable().optional(),
})

export const updateUserSchema = createUserSchema.partial()

// Fields a user can update on their own profile
export const updateProfileSchema = z.object({
  name: z
    .string({ error: 'الاسم غير صالح' })
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
    .optional(),
  phone: z
    .string({ error: 'رقم الواتساب غير صالح' })
    .regex(egyptianPhoneRegex, 'رقم الواتساب يجب أن يكون رقماً مصرياً صالحاً (مثال: 01012345678)')
    .optional(),
  currentPassword: z
    .string({ error: 'كلمة المرور الحالية مطلوبة' })
    .min(1, 'كلمة المرور الحالية مطلوبة')
    .optional(),
  newPassword: z
    .string({ error: 'كلمة المرور الجديدة غير صالحة' })
    .min(6, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل')
    .optional(),
}).refine(
  (data) => {
    const hasNew = !!data.newPassword
    const hasCurrent = !!data.currentPassword
    return hasNew === hasCurrent
  },
  { message: 'يجب تقديم كلمة المرور الحالية والجديدة معاً' }
)

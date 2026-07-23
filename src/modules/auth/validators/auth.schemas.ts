import { z } from 'zod'

const egyptianPhoneRegex = /^(\+?2)?01[0125][0-9]{8}$/

export const loginSchema = z.object({
  phone: z
    .string({ error: 'رقم الهاتف مطلوب' })
    .min(1, 'رقم الهاتف مطلوب')
    .regex(egyptianPhoneRegex, 'رقم الهاتف يجب أن يكون رقماً مصرياً صالحاً (مثال: 01012345678)'),
  password: z
    .string({ error: 'كلمة المرور مطلوبة' })
    .min(1, 'كلمة المرور مطلوبة'),
})

export const registerSchema = z.object({
  name: z
    .string({ error: 'الاسم مطلوب' })
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z
    .string({ error: 'رقم الموبايل مطلوب' })
    .regex(egyptianPhoneRegex, 'رقم الموبايل يجب أن يكون رقماً مصرياً صالحاً (مثال: 01012345678)'),
  password: z
    .string({ error: 'كلمة المرور مطلوبة' })
    .min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
})

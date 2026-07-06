import { z } from 'zod'

const usernameRegex = /^[a-zA-Z0-9_]+$/
const egyptianPhoneRegex = /^(\+?2)?01[0125][0-9]{8}$/

export const loginSchema = z.object({
  username: z
    .string({ error: 'اسم المستخدم مطلوب' })
    .min(1, 'اسم المستخدم مطلوب'),
  password: z
    .string({ error: 'كلمة المرور مطلوبة' })
    .min(1, 'كلمة المرور مطلوبة'),
})

export const registerSchema = z.object({
  name: z
    .string({ error: 'الاسم مطلوب' })
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  username: z
    .string({ error: 'اسم المستخدم مطلوب' })
    .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    .regex(usernameRegex, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط'),
  password: z
    .string({ error: 'كلمة المرور مطلوبة' })
    .min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  phone: z
    .string({ error: 'رقم الموبايل مطلوب' })
    .regex(egyptianPhoneRegex, 'رقم الموبايل يجب أن يكون رقماً مصرياً صالحاً'),
})

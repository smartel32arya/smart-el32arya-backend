import { z } from 'zod'

export const loginSchema = z.object({
  username: z
    .string({ error: 'اسم المستخدم مطلوب' })
    .min(1, 'اسم المستخدم مطلوب'),
  password: z
    .string({ error: 'كلمة المرور مطلوبة' })
    .min(1, 'كلمة المرور مطلوبة'),
})

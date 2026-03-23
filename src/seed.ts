import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { connectDB } from './db'
import Property from './models/Property'
import User from './models/User'
import { formatPrice } from './utils/formatPrice'

const properties = [
  {
    title: 'شقة فاخرة في حي الزهراء',
    description: 'شقة فاخرة بتشطيب سوبر لوكس في قلب حي الزهراء، قريبة من جميع الخدمات والمرافق',
    price: 1200000,
    priceFormatted: formatPrice(1200000),
    location: 'المنيا الجديدة، حي الزهراء',
    neighborhood: 'حي الزهراء' as const,
    type: 'شقة' as const,
    bedrooms: 3,
    bathrooms: 2,
    area: 150,
    images: ['/uploads/properties/sample1.jpg', '/uploads/properties/sample2.jpg'],
    image: '/uploads/properties/sample1.jpg',
    amenities: ['تكييف مركزي', 'مصعد', 'جراج', 'حديقة'],
    featured: true,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    title: 'فيلا راقية في الحي الثامن',
    description: 'فيلا مستقلة بتصميم عصري في الحي الثامن، تتميز بحديقة خاصة ومسبح',
    price: 4500000,
    priceFormatted: formatPrice(4500000),
    location: 'المنيا الجديدة، الحي الثامن',
    neighborhood: 'الحي الثامن' as const,
    type: 'فيلا' as const,
    bedrooms: 5,
    bathrooms: 4,
    area: 400,
    images: ['/uploads/properties/sample3.jpg', '/uploads/properties/sample4.jpg'],
    image: '/uploads/properties/sample3.jpg',
    amenities: ['مسبح', 'حديقة خاصة', 'جراج مزدوج', 'غرفة حارس'],
    featured: true,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    title: 'دوبلكس مميز في الحي الأول',
    description: 'دوبلكس واسع بإطلالة رائعة في الحي الأول، يتكون من طابقين بتشطيب متميز',
    price: 2800000,
    priceFormatted: formatPrice(2800000),
    location: 'المنيا الجديدة، الحي الأول',
    neighborhood: 'الحي الأول' as const,
    type: 'دوبلكس' as const,
    bedrooms: 4,
    bathrooms: 3,
    area: 280,
    images: ['/uploads/properties/sample5.jpg'],
    image: '/uploads/properties/sample5.jpg',
    amenities: ['تراس', 'مصعد خاص', 'تكييف مركزي'],
    featured: false,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    title: 'محل تجاري في المحور المركزي',
    description: 'محل تجاري استراتيجي على المحور المركزي بواجهة زجاجية وموقع متميز',
    price: 3200000,
    priceFormatted: formatPrice(3200000),
    location: 'المنيا الجديدة، المحور المركزي',
    neighborhood: 'المحور المركزي' as const,
    type: 'تجاري' as const,
    bedrooms: 0,
    bathrooms: 1,
    area: 120,
    images: ['/uploads/properties/sample6.jpg'],
    image: '/uploads/properties/sample6.jpg',
    amenities: ['واجهة زجاجية', 'تكييف', 'كاميرات مراقبة'],
    featured: true,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    title: 'شقة اقتصادية في الحي الثامن',
    description: 'شقة بتشطيب جيد في الحي الثامن، مناسبة للعائلات الصغيرة بسعر مناسب',
    price: 750000,
    priceFormatted: formatPrice(750000),
    location: 'المنيا الجديدة، الحي الثامن',
    neighborhood: 'الحي الثامن' as const,
    type: 'شقة' as const,
    bedrooms: 2,
    bathrooms: 1,
    area: 100,
    images: ['/uploads/properties/sample7.jpg'],
    image: '/uploads/properties/sample7.jpg',
    amenities: ['مصعد', 'أمن وحراسة'],
    featured: false,
    active: false,
    createdAt: new Date().toISOString(),
  },
  {
    title: 'فيلا توين هاوس في حي الزهراء',
    description: 'توين هاوس أنيق في حي الزهراء بتصميم حديث وحديقة أمامية وخلفية',
    price: 5000000,
    priceFormatted: formatPrice(5000000),
    location: 'المنيا الجديدة، حي الزهراء',
    neighborhood: 'حي الزهراء' as const,
    type: 'فيلا' as const,
    bedrooms: 4,
    bathrooms: 3,
    area: 320,
    images: ['/uploads/properties/sample8.jpg', '/uploads/properties/sample9.jpg'],
    image: '/uploads/properties/sample8.jpg',
    amenities: ['حديقة أمامية وخلفية', 'جراج', 'غرفة خادمة', 'تكييف مركزي'],
    featured: false,
    active: true,
    createdAt: new Date().toISOString(),
  },
]

export async function seedDatabase(): Promise<void> {
  // Clear existing data and drop stale indexes
  await Property.deleteMany({})
  await User.deleteMany({})
  // Drop all non-_id indexes to remove stale unique constraints (e.g. old email_1)
  await User.collection.dropIndexes()
  console.log('Cleared existing Property and User records')

  // Insert properties using insertMany (bypasses pre-save hooks)
  await Property.insertMany(properties)
  console.log(`Inserted ${properties.length} properties`)

  // Create super admin user
  const hashedPassword = await bcrypt.hash('YasserRostom@87749', 10)
  await User.create({
    name: 'YasserRostom',
    username: 'YasserRostom',
    password: hashedPassword,
    role: 'super_admin',
    active: true,
  })
  console.log('Created super_admin user: YasserRostom')

  // Default seed user
  const defaultHash = await bcrypt.hash('admin123', 10)
  await User.create({
    name: 'Super Admin',
    username: 'admin',
    password: defaultHash,
    role: 'super_admin',
    active: true,
  })
  console.log('Created default super_admin user: admin')

  console.log('✅ Seed completed successfully')
}

async function seed() {
  await connectDB()
  await seedDatabase()
  await mongoose.connection.close()
  console.log('Database connection closed')
}

// Only run when executed directly (not when imported in tests)
if (require.main === module) {
  seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
}

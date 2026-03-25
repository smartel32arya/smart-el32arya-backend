import { Router, Request, Response } from 'express';
import Property from '../../models/Property';
import { upload, handleUploadError, uploadToCloudinary, uploadVideoToCloudinary } from '../../middleware/imageUploader';

export const adminPropertiesRouter = Router();

// POST / — create a new property (multipart/form-data)
adminPropertiesRouter.post(
  '/',
  upload.fields([{ name: 'images' }, { name: 'video', maxCount: 1 }]),
  handleUploadError,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body;
      const fields = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      // Upload images to Cloudinary
      const imageFiles = fields?.images ?? [];
      const images: string[] = imageFiles.length > 0
        ? await Promise.all(imageFiles.map((f) => uploadToCloudinary(f.buffer, f.mimetype)))
        : [];

      // Upload optional video to Cloudinary
      const videoFiles = fields?.video ?? [];
      const video: string | null = videoFiles.length > 0
        ? await uploadVideoToCloudinary(videoFiles[0].buffer)
        : null;

      // Parse numeric fields
      const price = parseFloat(body.price);
      const bedrooms = parseInt(body.bedrooms, 10);
      const bathrooms = parseInt(body.bathrooms, 10);
      const area = parseFloat(body.area);

      // Parse boolean fields
      const featured = body.featured === 'true';
      const active = body.active === 'true';

      // Parse amenities
      let amenities: string[] = [];
      if (body.amenities) {
        amenities = typeof body.amenities === 'string'
          ? JSON.parse(body.amenities)
          : body.amenities;
      }

      const property = new Property({
        title: body.title,
        description: body.description,
        price,
        location: body.location,
        neighborhood: body.neighborhood,
        type: body.type,
        bedrooms,
        bathrooms,
        area,
        images,
        video,
        amenities,
        featured,
        active,
      });

      await property.save();
      res.status(201).json(property);
    } catch (err) {
      res.status(500).json({ message: 'حدث خطأ أثناء إنشاء العقار', error: (err as Error).message });
    }
  }
);

// PUT /:id — update a property (application/json)
adminPropertiesRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const property = await Property.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!property) {
      res.status(404).json({ message: 'العقار غير موجود' });
      return;
    }

    res.json(property);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل العقار', error: (err as Error).message });
  }
});

// DELETE /:id — delete a property
adminPropertiesRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const property = await Property.findOneAndDelete({ id: req.params.id });

    if (!property) {
      res.status(404).json({ message: 'العقار غير موجود' });
      return;
    }

    res.json({ message: 'تم حذف العقار بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء حذف العقار', error: (err as Error).message });
  }
});

import { Router, Request, Response } from 'express';
import Property from '../../models/Property';
import {
  upload,
  handleUploadError,
  uploadToCloudinary,
  uploadVideoToCloudinary,
  deleteFromCloudinary,
} from '../../middleware/imageUploader';

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
      res.status(500).json({ message: 'حدث خطأ أثناء إنشاء العقار' });
    }
  }
);

// PUT /:id — update a property (multipart/form-data)
adminPropertiesRouter.put(
  '/:id',
  upload.fields([{ name: 'images' }, { name: 'video', maxCount: 1 }]),
  handleUploadError,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const property = await Property.findOne({ id: req.params.id });
      if (!property) {
        res.status(404).json({ message: 'العقار غير موجود' });
        return;
      }

      const body = req.body;
      const fields = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      // --- Images ---
      let existingImages: string[] = [];
      if (body.existingImages) {
        existingImages = typeof body.existingImages === 'string'
          ? JSON.parse(body.existingImages)
          : body.existingImages;
      }

      // Delete images that were removed by the client
      const removedImages = (property.images ?? []).filter((url) => !existingImages.includes(url));
      await Promise.all(removedImages.map((url) => deleteFromCloudinary(url, 'image')));

      // Upload new image files and append
      const newImageFiles = fields?.images ?? [];
      const newImageUrls = newImageFiles.length > 0
        ? await Promise.all(newImageFiles.map((f) => uploadToCloudinary(f.buffer, f.mimetype)))
        : [];

      const finalImages = [...existingImages, ...newImageUrls];

      // --- Video ---
      const videoFiles = fields?.video ?? [];
      let finalVideo: string | null = null;

      if (videoFiles.length > 0) {
        // New video uploaded — delete old one if it existed
        if (property.video) await deleteFromCloudinary(property.video, 'video');
        finalVideo = await uploadVideoToCloudinary(videoFiles[0].buffer);
      } else if (body.videoUrl) {
        // Keep existing video URL as-is
        finalVideo = body.videoUrl;
      } else {
        // No video provided — clear it
        if (property.video) await deleteFromCloudinary(property.video, 'video');
        finalVideo = null;
      }

      // --- Scalar fields ---
      const price = parseInt(body.price, 10);
      const bedrooms = parseInt(body.bedrooms, 10);
      const bathrooms = parseInt(body.bathrooms, 10);
      const area = parseInt(body.area, 10);
      const featured = body.featured === 'true';
      const active = body.active === 'true';
      let amenities: string[] = [];
      if (body.amenities) {
        amenities = typeof body.amenities === 'string'
          ? JSON.parse(body.amenities)
          : body.amenities;
      }

      if (!body.title || !body.description || !body.neighborhood || !body.type) {
        res.status(400).json({ message: 'الحقول المطلوبة مفقودة' });
        return;
      }

      property.title = body.title;
      property.description = body.description;
      property.price = price;
      property.neighborhood = body.neighborhood;
      property.type = body.type;
      property.location = body.location ?? property.location;
      property.area = area;
      property.bedrooms = bedrooms;
      property.bathrooms = bathrooms;
      property.amenities = amenities;
      property.featured = featured;
      property.active = active;
      property.images = finalImages;
      property.video = finalVideo;

      await property.save();
      res.json(property);
    } catch (err) {
      res.status(500).json({ message: 'حدث خطأ أثناء تعديل العقار' });
    }
  }
);

// DELETE /:id — delete a property and its assets
adminPropertiesRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const property = await Property.findOne({ id: req.params.id });

    if (!property) {
      res.status(404).json({ message: 'العقار غير موجود' });
      return;
    }

    // Delete all images and video from Cloudinary
    const deletions: Promise<void>[] = (property.images ?? []).map((url) =>
      deleteFromCloudinary(url, 'image')
    );
    if (property.video) deletions.push(deleteFromCloudinary(property.video, 'video'));
    await Promise.all(deletions);

    await property.deleteOne();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء حذف العقار' });
  }
});

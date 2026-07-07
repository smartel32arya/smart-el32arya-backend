import { Request, Response } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import { config } from '../../../config'

export class CloudinaryController {
  signUpload = (req: Request, res: Response): void => {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000)
      const folder = 'smart-realestate/properties' // Must match the folder used in imageUploader.ts

      const signature = cloudinary.utils.api_sign_request(
        {
          timestamp,
          folder,
        },
        config.cloudinary.apiSecret
      )

      res.json({
        signature,
        timestamp,
        api_key: config.cloudinary.apiKey,
        cloud_name: config.cloudinary.cloudName,
        folder,
      })
    } catch (error) {
      console.error('[Cloudinary Sign Error]', error)
      res.status(500).json({ message: 'فشل في إنشاء تصريح الرفع' })
    }
  }
}

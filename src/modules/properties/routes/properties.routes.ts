import { Router } from 'express'
import { PropertyController } from '../controllers/PropertyController'
import { optionalAuthenticate } from '../../../middleware/optionalAuthenticate'

const controller = new PropertyController()

export const propertiesRouter = Router()

propertiesRouter.get('/featured', controller.getFeatured)
propertiesRouter.get('/:id', controller.getById)
propertiesRouter.get('/', optionalAuthenticate, controller.listProperties)

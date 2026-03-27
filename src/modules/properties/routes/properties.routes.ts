import { Router } from 'express'
import { PropertyController } from '../controllers/PropertyController'

const controller = new PropertyController()

export const propertiesRouter = Router()

propertiesRouter.get('/featured', controller.getFeatured)
propertiesRouter.get('/:id', controller.getById)
propertiesRouter.get('/', controller.listProperties)

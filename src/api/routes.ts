import { Router } from 'express';

import { documentController, userController } from './controllers';
import routeAuthMiddleware from './middleware/route-auth-middleware';

const router = Router();

router.post(
  '/users',
  routeAuthMiddleware((req) => req.body.address),
  userController.getOrCreate
);
router.patch(
  '/users/:address',
  routeAuthMiddleware((req) => req.params.address),
  userController.edit
);

router.get('/documents', documentController.list);

export default router;

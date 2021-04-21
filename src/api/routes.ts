import { Router } from 'express';

import { documentController, userController } from './controllers';

const router = Router();

// router.post(
//   '/users',
//   // routeAuthMiddleware((req) => req.body.address),
//   userController.getOrCreate
// );
router.patch(
  '/users/:address',
  // routeAuthMiddleware((req) => req.params.address),
  userController.oauth
);

router.get('/documents', documentController.list);

export default router;

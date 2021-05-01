import { Router } from 'express';

import { documentController, userController } from './controllers';
import { authMiddleware } from './middleware';

const router = Router();

router.post('/users/oauth', userController.oauth);

router.get('/documents/:uidOrHash', documentController.getDetails);
router.get('/documents/:uidOrHash/hashes', documentController.getHashes);
router.get('/documents/:uidOrHash/validate', documentController.validate);
router.post('/documents/:uid/sign', documentController.sign);

router.get('/documents', authMiddleware, documentController.list);
router.post('/documents', authMiddleware, documentController.send);

export default router;

import { Router } from 'express';

import { documentController, userController } from './controllers';
import { authMiddleware } from './middleware';

const router = Router();

router.post('/users/oauth', userController.oauth);

router.get('/documents', documentController.list);
router.get('/documents/:uidOrHash', documentController.getDetails);
router.get('/documents/:uidOrHash/hashes', documentController.getHashes);
router.get('/documents/:uidOrHash/validate', documentController.validate);
router.post('/documents/send', authMiddleware, documentController.send);
router.post('/documents/:uid/sign', documentController.sign);

export default router;

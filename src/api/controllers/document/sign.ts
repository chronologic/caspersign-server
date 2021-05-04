import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const sign: RequestHandler = async (req, res) => {
  const doc = await documentService.sign(req.body.signerInfo, req.body.signatureInfo);

  res.send(doc);
};

export default requestMiddleware(sign);

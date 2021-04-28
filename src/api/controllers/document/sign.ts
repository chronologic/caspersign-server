import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const sign: RequestHandler = async (req, res) => {
  // TODO: validate req.body
  const doc = await documentService.sign(req.ip, req.body);

  res.send(doc);
};

export default requestMiddleware(sign);

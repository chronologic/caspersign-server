import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const sign: RequestHandler = async (req, res) => {
  // TODO: make sure req.body has correct data
  const doc = await documentService.sign(req.ip, req.body);

  res.send(doc);
};

export default requestMiddleware(sign);

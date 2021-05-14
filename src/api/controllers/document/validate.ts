import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const validate: RequestHandler = async (req, res) => {
  const doc = await documentService.validate(req.params.uidOrHash);

  res.send(doc);
};

export default requestMiddleware(validate);

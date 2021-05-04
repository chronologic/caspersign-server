import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const validate: RequestHandler = async (req, res) => {
  const doc = await documentService.getDocumentDetails(req.params.uidOrHash, true);

  res.send(doc);
};

export default requestMiddleware(validate);

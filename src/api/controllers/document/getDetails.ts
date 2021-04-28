import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const getDetails: RequestHandler = async (req, res) => {
  const doc = await documentService.getDocumentDetails(req.params.uidOrHash);

  res.send(doc);
};

export default requestMiddleware(getDetails);

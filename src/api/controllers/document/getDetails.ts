import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const getDetails: RequestHandler = async (req, res) => {
  const { hash } = req.query;
  const doc = documentService.getDocumentDetails(hash as string);

  res.send(doc);
};

export default requestMiddleware(getDetails);

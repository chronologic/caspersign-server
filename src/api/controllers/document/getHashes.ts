import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const getHashes: RequestHandler = async (req, res) => {
  const hashes = await documentService.getHashes(req.params.uidOrHash);

  res.send(hashes);
};

export default requestMiddleware(getHashes);

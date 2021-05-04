import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';

const getHashes: RequestHandler = async (req, res) => {
  const hashes = await documentService.getHashesByHashOrSignatureId(req.params.uidOrHash);

  res.send(hashes);
};

export default requestMiddleware(getHashes);

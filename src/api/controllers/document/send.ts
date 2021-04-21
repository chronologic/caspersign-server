import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService, hellosignService } from '../../services';
import { RequestWithAuth } from '../../types';

const send: RequestHandler = async (req: RequestWithAuth, res) => {
  const hs = hellosignService.createOauthClient(req.user.oauthToken);
  // TODO: make sure req.body has correct data
  const doc = await documentService.sendForSignatures(hs, req.user.id, req.body);

  res.send(doc);
};

export default requestMiddleware(send);

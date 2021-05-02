import { RequestHandler } from 'express';
import { SignatureRequestRequestOptions } from 'hellosign-sdk';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';
import { RequestWithAuth } from '../../types';

const send: RequestHandler = async (req: RequestWithAuth, res) => {
  const data: Partial<SignatureRequestRequestOptions> = {
    files: [(req as any).files.file.path],
    signers: req.body.signers.map((sig: string) => JSON.parse(sig)),
    title: req.body.title,
    message: req.body.message,
  };

  const doc = await documentService.sendForSignatures(req.user, data as any);

  res.send(doc);
};

export default requestMiddleware(send);

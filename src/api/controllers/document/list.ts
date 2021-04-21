import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService, hellosignService } from '../../services';
import { RequestWithAuth } from '../../types';

const list: RequestHandler = async (req: RequestWithAuth, res) => {
  const { page = 1, pageSize = 20, query } = req.query;
  const hs = hellosignService.createOauthClient(req.user.oauthToken);

  const itemsWithMeta = await documentService.listDocuments(hs, {
    page: page as number,
    page_size: pageSize as number,
    query: query as string,
  });

  res.send(itemsWithMeta);
};

export default requestMiddleware(list);

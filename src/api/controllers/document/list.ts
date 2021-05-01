import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { documentService } from '../../services';
import { RequestWithAuth } from '../../types';

const list: RequestHandler = async (req: RequestWithAuth, res) => {
  const { page = 1, pageSize = 25, query } = req.query;

  const itemsWithMeta = await documentService.listDocuments(req.user, {
    page: page as number,
    page_size: pageSize as number,
    query: query as string,
  });

  res.send(itemsWithMeta);
};

export default requestMiddleware(list);

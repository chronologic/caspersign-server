import { RequestHandler, Response, NextFunction } from 'express';

import logger from '../../logger';
import Unauthorized from '../errors/unauthorized';
import { RequestWithAuth } from '../types';

type AddrGetter = (req: RequestWithAuth) => string;

export const routeAuthMiddleware = (getter: AddrGetter): RequestHandler => (
  req: RequestWithAuth,
  res: Response,
  next: NextFunction
) => {
  const address = (getter(req) || '').toLowerCase();
  const authAddress = req?.authenticatedAddress.toLowerCase();

  if (address !== req.authenticatedAddress) {
    logger.debug('Route auth invalid:', { address, authAddress });
    return next(new Unauthorized());
  }

  return next();
};

export default routeAuthMiddleware;

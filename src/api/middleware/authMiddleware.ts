import { RequestHandler, Response, NextFunction } from 'express';

import logger from '../../logger';
import { UnauthorizedError } from '../errors';
import { RequestWithAuth } from '../types';
import { userService } from '../services';

export const authMiddleware = async (req: RequestWithAuth, res: Response, next: NextFunction) => {
  const token = decodeAuthHeader(req.headers.authorization);

  if (!token) {
    logger.debug('Auth token missing');
    return next(new UnauthorizedError());
  }

  const user = await userService.getUserByToken(token);

  if (!user) {
    logger.debug('User not found');
    return next(new UnauthorizedError());
  }

  req.user = user;
  return next();
};

function decodeAuthHeader(header: string): string {
  try {
    const authToken = header.split(' ')[1];

    return authToken;
  } catch (e) {
    logger.error(e);
    return null;
  }
}

export default authMiddleware;

import { RequestHandler, Response, NextFunction } from 'express';
import * as ethers from 'ethers';
import atob from 'atob';

import Unauthorized from '../errors/unauthorized';
import { RequestWithAuth } from '../types';
import { MESSAGE_TO_SIGN } from '../constants';
import logger from '../logger';

export const authMiddleware = (): RequestHandler => (req: RequestWithAuth, res: Response, next: NextFunction) => {
  const { user, pass } = decodeAuthHeader(req.headers.authorization);

  logger.debug({ user, pass });

  if (!user || !pass) {
    logger.debug('Auth data missing:', { user, pass });
    return next(new Unauthorized());
  }

  const valid = ethers.utils.verifyMessage(MESSAGE_TO_SIGN, pass).toLowerCase() === user;

  logger.debug(`Auth valid: ${valid}`);

  if (!valid) {
    logger.debug('Auth invalid:', { user, pass, MESSAGE_TO_SIGN });
    return next(new Unauthorized());
  }

  req.authenticatedAddress = user;
  return next();
};

function decodeAuthHeader(header: string): { user: string; pass: string } {
  try {
    const authToken = header.split(' ')[1];
    const [user, pass] = atob(authToken)
      .split(':')
      .map((s) => s.toLowerCase());

    return { user, pass };
  } catch (e) {
    logger.error(e);
    return { user: undefined, pass: undefined };
  }
}

export default authMiddleware;

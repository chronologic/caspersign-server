import { RequestHandler, Request, Response, NextFunction } from 'express';
import Joi from '@hapi/joi';

import { LOG_LEVEL } from '../env';
import BadRequest from '../errors/bad-request';
import logger from '../logger';

const getMessageFromJoiError = (error: Joi.ValidationError): string | undefined => {
  if (!error.details && error.message) {
    return error.message;
  }
  return error.details && error.details.length > 0 && error.details[0].message
    ? `PATH: [${error.details[0].path}] ;; MESSAGE: ${error.details[0].message}`
    : undefined;
};

interface HandlerOptions {
  validation?: {
    body?: Joi.ObjectSchema;
  };
}

/**
 * This router wrapper catches any error from async await
 * and throws it to the default express error handler,
 * instead of crashing the app
 * @param handler Request handler to check for error
 */
export const requestMiddleware = (handler: RequestHandler, options?: HandlerOptions): RequestHandler => async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (options?.validation?.body) {
    const { error } = options?.validation?.body.validate(req.body);
    if (error != null) {
      return next(new BadRequest(getMessageFromJoiError(error)));
    }
  }
  try {
    return handler(req, res, next);
  } catch (err) {
    if (LOG_LEVEL === 'debug') {
      logger.error(err);
    }
    return next(err);
  }
};

export default requestMiddleware;

import ApplicationError from './application-error';

export default class NotFoundError extends ApplicationError {
  constructor(message?: string) {
    super(message || 'Not Found', 404);
  }
}

import { Request } from 'express';

export interface RequestWithAuth extends Request {
  authenticatedAddress: string;
}

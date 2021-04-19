import { Request } from 'express';

export interface RequestWithAuth extends Request {
  authenticatedAddress: string;
}

export interface DocumentDetails {
  title: string;
  createdAt: string;
  signatures: SignatureDetails[];
}

export interface SignatureDetails {
  email: string;
  name: string;
  completed: boolean;
  txHash: string;
  createdAt: string;
}

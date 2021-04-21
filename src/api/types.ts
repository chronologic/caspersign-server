import { Request } from 'express';

import { Document } from '../db';

export interface RequestWithAuth extends Request {
  authenticatedAddress: string;
}

export interface DocumentSummary {
  documentUid: string;
  title: string;
  status: Document['Status'];
  createdAt: string;
  signatures: SignatureSummary[];
}

export interface DocumentDetails extends DocumentSummary {
  signatures: SignatureDetails[];
  hashes: string[];
}

export interface SignatureSummary {
  signatureUid: string;
  email: string;
  name: string;
  completed: boolean;
  txHash: string;
  createdAt: string;
}

export interface SignatureDetails extends SignatureSummary {
  hs: {
    email: string;
    name: string;
    statusCode: string;
    signedAt: string;
  };
}

export interface DocumentListParams {
  page?: number;
  // eslint-disable-next-line camelcase
  page_size?: number;
  query?: string;
}

export interface SignerInfo {
  documentUid: string;
  signatureUid: string;
  email: string;
  documentHashes: string[];
  payload: string;
}

export interface SignatureInfo {
  e: string; // signer hashed email
  r: string; // recipient hashed email
  t: number; // timestamp
  h: string[]; // document hashes
  p: string; // signer pubkey
  s: string; // signature
}

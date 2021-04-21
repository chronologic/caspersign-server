/* eslint-disable camelcase */
import { Request } from 'express';

import { Document, User } from '../db';

export interface RequestWithAuth extends Request {
  user: User;
}

export interface HsOauthResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
}

export interface PaginatedDocuments {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  items: DocumentSummary[];
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

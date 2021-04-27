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
  createdByEmail: string;
  signatures: SignatureDetails[];
  hashes: string[];
  history?: DocumentHistory[];
}

export enum DocumentHistoryType {
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  SIGNED = 'SIGNED',
  COMPLETED = 'COMPLETED',
  SIGNED_ON_CHAIN = 'SIGNED_ON_CHAIN',
}

export interface DocumentHistory {
  type: DocumentHistoryType;
  timestamp?: string;
  ip?: string;
  email: string;
  description: string;
  txHash?: string;
}

export interface SignatureSummary {
  signatureUid: string;
  ip: string;
  email: string;
  name: string;
  completed: boolean;
  payload?: string;
  txHash: string;
  signedAt?: string;
}

export interface SignatureDetails extends SignatureSummary {
  hs: {
    isOwner: boolean;
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
  i: string; // signer hashed IP
  t: number; // timestamp
  h: string[]; // document hashes
  p: string; // signer pubkey
  s: string; // signature
}

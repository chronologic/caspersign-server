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
  meta: PaginationMeta;
  items: DocumentSummary[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface DocumentSummary {
  documentUid: string;
  title: string;
  status: Document['Status'];
  createdAt: string;
  originalHash: string;
  signatures: SignatureSummary[];
}

export interface DocumentDetails extends DocumentSummary {
  createdByEmail: string;
  createdByName: string;
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
  verifier: string;
  email: string;
  ip: string;
}

export interface SignatureInfo {
  verifier: string;
  signerHash: string;
  recipientHash: string;
  ipHash: string;
  timestamp: number;
  originalDocumentHash: string;
  otherSignatures: string[];
  documentHashes: string[];
  signerPubkey: string;
}

export interface SignatureInfoSigned extends SignatureInfo {
  signature: string;
}

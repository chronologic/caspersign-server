import groupBy from 'lodash/groupBy';

import { Document, DocumentHash, getConnection, Signature, SignatureTx } from '../../db';
import { DocumentDetails, SignatureDetails } from '../types';
import { hsApp } from './hellosign';

export async function getDocumentDetails(hashOrSignatureId: string): Promise<DocumentDetails> {
  const documentUid = await getDocumentIdFromHashOrSignatureId(hashOrSignatureId);
  // TODO: do we need this?
  const hsDoc = await hsApp.signatureRequest.get(documentUid);
  // TODO: check response for errors
  const doc = await getDocumentByUid(documentUid);
  return doc;
}

export async function getDocumentIdFromHashOrSignatureId(hashOrSignatureId: string): Promise<string> {
  const connection = getConnection();

  const q = connection.createQueryBuilder().select('"documentUid"').from(Document, 'd');
  const exists1 = q
    .subQuery()
    .select('1')
    .from(DocumentHash, 'dh')
    .where('dh."documentId" = d.id')
    .andWhere('"hash" = :hash', { hash: hashOrSignatureId });
  const exists2 = q
    .subQuery()
    .select('1')
    .from(Signature, 's')
    .where('s."documentId" = d.id')
    .andWhere('"signatureUid" = :sig', { sig: hashOrSignatureId });

  const res = await q.where(`exists ${exists1.getQuery()}`).orWhere(`exists ${exists2.getQuery()}`).execute();

  // TODO: check result

  return res[0].documentUid;
}

export async function getDocumentByUid(uid: string): Promise<DocumentDetails> {
  const [doc] = await getDocumentsByUid([uid]);

  return doc;
}

export async function getDocumentsByUid(uids: string[]): Promise<DocumentDetails[]> {
  const connection = getConnection();

  const rawItems = await connection
    .createQueryBuilder()
    .select([
      'd."documentUid" as "documentUid"',
      'd.title as "title"',
      'd."createDate" as "createdAt"',
      's.name as "name"',
      's.email as "email"',
      's.status as "status"',
      's.createDate as "signedAt"',
      'stx.txHash as "txHash"',
    ])
    .from(Document, 'd')
    .leftJoin(Signature, 's', 'd.id = s."documentId"')
    .leftJoin(SignatureTx, 'stx', 's.id = stx."signatureId"')
    .where('d."documentUid" in (...:uids)', { uids })
    .execute();

  const groups = groupBy(rawItems, 'documentUid');

  const docsWithDetails = Object.keys(groups).map((uid) => {
    const rows = groups[uid];
    const first = rows[0];

    const signatures = rows.map((row) => {
      const signatureDetails: SignatureDetails = {
        completed: row.status === Signature.Status.SIGNED,
        email: row.email,
        name: row.name,
        txHash: row.txHash,
        createdAt: row.signedAt,
      };

      return signatureDetails;
    });

    const item: DocumentDetails = {
      title: first.title,
      createdAt: first.createdAt,
      signatures,
    };

    return item;
  });

  return docsWithDetails;
}

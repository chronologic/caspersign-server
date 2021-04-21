import groupBy from 'lodash/groupBy';
import HelloSign, { SignatureRequestRequestOptions } from 'hellosign-sdk';

import { Document, DocumentHash, getConnection, Signature, SignatureTx } from '../../db';
import {
  DocumentDetails,
  DocumentListParams,
  DocumentSummary,
  PaginatedDocuments,
  SignatureSummary,
  SignerInfo,
} from '../types';
import { sha256Hex } from '../utils';
import { hsApp, HsExtended } from './hellosign';
import { getAndUpdateHashes } from './documentHash';
import { saveSignatures } from './signature';

export async function getDocumentDetails(hashOrSignatureId: string): Promise<DocumentDetails> {
  const documentUid = await getDocumentUidFromHashOrSignatureId(hashOrSignatureId);
  const docSummary = await getDocumentByUid(documentUid);
  const { signature_request } = await hsApp.signatureRequest.get(documentUid);
  // TODO: skip downloading the file if we know there's no updates
  const file = await hsApp.downloadFile(documentUid);
  const hash = sha256Hex(file);
  const hashes = await getAndUpdateHashes(documentUid, [hash]);
  const docStatus = await calculateAndUpdateDocumentStatus(documentUid, signature_request);

  return {
    ...docSummary,
    status: docStatus,
    hashes,
    signatures: docSummary.signatures.map((sig) => {
      const hsSignatureDetails = signature_request.signatures.find((s) => s.signature_id === sig.signatureUid);
      return {
        ...sig,
        hs: {
          email: hsSignatureDetails.signer_email_address,
          name: hsSignatureDetails.signer_name,
          signedAt: new Date(hsSignatureDetails.signed_at * 1000).toISOString(),
          statusCode: hsSignatureDetails.status_code,
        },
      };
    }),
  };
}

async function calculateAndUpdateDocumentStatus(
  documentUid: string,
  hsDetails: HelloSign.SignatureRequest
): Promise<Document['Status']> {
  let status = Document.Status.OUT_FOR_SIGNATURE;

  if (hsDetails.is_complete) {
    status = Document.Status.COMPLETED;
  } else if (hsDetails.is_declined) {
    status = Document.Status.DECLINED;
  } else {
    const isSignedByRequester = hsDetails.signatures.some(
      (sig) => sig.signer_email_address === hsDetails.requester_email_address && sig.status_code === 'signed'
    );
    const isSignedByOthers = hsDetails.signatures
      .filter((sig) => sig.signer_email_address !== hsDetails.requester_email_address)
      .every((sig) => sig.status_code === 'signed');

    if (!isSignedByRequester && isSignedByOthers) {
      status = Document.Status.AWAITING_MY_SIGNATURE;
    }
  }

  const connection = getConnection();
  await connection.createEntityManager().update(Document, { documentUid }, { status });

  return status;
}

async function getDocumentUidFromHashOrSignatureId(hashOrSignatureId: string): Promise<string> {
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

export async function getDocumentByUid(uid: string): Promise<DocumentSummary> {
  const [doc] = await getDocumentsByUids([uid]);

  return doc;
}

export async function getDocumentsByUids(uids: string[]): Promise<DocumentSummary[]> {
  const connection = getConnection();

  const rawItems = await connection
    .createQueryBuilder()
    .select([
      'd."documentUid" as "documentUid"',
      'd.title as "title"',
      'd.status as "status"',
      'd."createDate" as "createdAt"',
      's."signatureUid" as "signatureUid"',
      's.name as "name"',
      's.email as "email"',
      's.status as "signatureStatus"',
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
      const signatureDetails: SignatureSummary = {
        signatureUid: row.signatureUid,
        completed: row.signatureStatus === Signature.Status.SIGNED,
        email: row.email,
        name: row.name,
        txHash: row.txHash,
        createdAt: row.signedAt,
      };

      return signatureDetails;
    });

    const item: DocumentSummary = {
      documentUid: first.documentUid,
      title: first.title,
      status: first.status,
      createdAt: first.createdAt,
      signatures,
    };

    return item;
  });

  return docsWithDetails;
}

export async function listDocuments(hs: HsExtended, params: DocumentListParams): Promise<PaginatedDocuments> {
  const res = await hs.signatureRequest.list(params);
  const uids = res.signature_requests.map((item) => item.signature_request_id);
  const items = await getDocumentsByUids(uids);
  const listInfo: {
    page: number;
    // eslint-disable-next-line camelcase
    num_pages: number;
    // eslint-disable-next-line camelcase
    num_results: number;
    // eslint-disable-next-line camelcase
    page_size: number;
  } = (res as any).list_info;

  return {
    meta: {
      page: listInfo.page,
      pageSize: listInfo.page_size,
      pages: listInfo.num_pages,
      total: listInfo.num_results,
    },
    items,
  };
}

export async function sendForSignatures(
  hs: HsExtended,
  userId: number,
  requestOptions: SignatureRequestRequestOptions
): Promise<DocumentDetails> {
  // TODO: generate and store original file hash
  // const file = requestOptions.files[0];
  // const hash = sha256Hex(file);

  const { signature_request } = await hs.signatureRequest.send(requestOptions);
  const file = await hs.downloadFile(signature_request.signature_request_id);
  const hash = sha256Hex(file);
  const doc = await saveDocument({
    documentUid: signature_request.signature_request_id,
    status: Document.Status.OUT_FOR_SIGNATURE,
    title: signature_request.title,
    userId,
  });
  await getAndUpdateHashes(doc.documentUid, [hash]);
  const sigs: Partial<Signature>[] = signature_request.signatures.map((sig) => ({
    documentId: doc.id,
    signatureUid: sig.signature_id,
    status: Signature.Status.PENDING,
    recipientEmail: sig.signer_email_address,
    name: sig.signer_name,
  }));
  await saveSignatures(sigs);

  return getDocumentDetails(hash);
}

async function saveDocument(doc: Partial<Document>): Promise<Document> {
  const connection = getConnection();
  const [createdDoc] = await connection.createEntityManager().save<Document>([doc as Document], { reload: true });

  return createdDoc;
}

export async function sign({ documentUid, email, documentHashes, payload, signatureUid }: SignerInfo): Promise<void> {
  // TODO: add checks of hashes, payload etc
  await getDocumentByUid(documentUid);
  const connection = getConnection();
  const sig = await connection.createEntityManager().findOne(Signature, { signatureUid });
  await saveSignatures([
    {
      ...sig,
      email,
      status: Signature.Status.SIGNED,
      payload,
    },
  ]);
  await getAndUpdateHashes(documentUid, documentHashes);
}

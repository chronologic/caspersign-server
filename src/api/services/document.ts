import groupBy from 'lodash/groupBy';
import HelloSign, { SignatureRequestRequestOptions } from 'hellosign-sdk';
import moment from 'moment-timezone';
import ipRegex from 'ip-regex';

import { Document, DocumentHash, getConnection, Signature, SignatureTx } from '../../db';
import {
  DocumentDetails,
  DocumentHistory,
  DocumentHistoryType,
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
import { storeSignatureTx } from './signatureTx';

const PdfParser = require('pdf2json');

export async function getDocumentDetails(hashOrSignatureId: string, withHistory = false): Promise<DocumentDetails> {
  const documentUid = await getDocumentUidFromHashOrSignatureId(hashOrSignatureId);
  const docSummary = await getDocumentByUid(documentUid);
  const { signature_request } = await hsApp.signatureRequest.get(documentUid);
  // TODO: skip downloading the file if we know there's no updates
  const file = await hsApp.downloadFile(documentUid);
  const hash = sha256Hex(file);
  const hashes = await getAndUpdateHashes(documentUid, [hash]);
  const docStatus = await calculateAndUpdateDocumentStatus(documentUid, signature_request);
  const signatures = docSummary.signatures.map((sig) => {
    const hsSignatureDetails = signature_request.signatures.find((s) => s.signature_id === sig.signatureUid);
    return {
      ...sig,
      hs: {
        isOwner: hsSignatureDetails.signer_email_address === signature_request.requester_email_address,
        email: hsSignatureDetails.signer_email_address,
        name: hsSignatureDetails.signer_name,
        signedAt: new Date(hsSignatureDetails.signed_at * 1000).toISOString(),
        statusCode: hsSignatureDetails.status_code,
      },
    };
  });
  const history = withHistory ? await getDocumentHistory(documentUid, docSummary.signatures) : null;

  return {
    ...docSummary,
    status: docStatus,
    hashes,
    signatures,
    history,
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
      's.ip as "ip"',
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
        ip: row.ip,
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

export async function sign(
  ip: string,
  { documentUid, email, documentHashes, payload, signatureUid }: SignerInfo
): Promise<void> {
  // TODO: add checks of hashes, payload etc
  await getDocumentByUid(documentUid);
  const connection = getConnection();
  const sig = await connection.createEntityManager().findOne(Signature, { signatureUid });
  await saveSignatures([
    {
      ...sig,
      ip,
      email,
      status: Signature.Status.SIGNED,
      payload,
    },
  ]);
  await getAndUpdateHashes(documentUid, documentHashes);
  await storeSignatureTx(sig.id, payload);
}

export async function getDocumentHistory(
  documentUid: string,
  signatures: SignatureSummary[]
): Promise<DocumentHistory[]> {
  const file = await hsApp.downloadFile(documentUid);
  const pdfJson = await parsePdf(file);
  const rows = extractPdfAuditRows(pdfJson);
  const historyItems = pdfRowsToHistoryItems(rows);
  const allHistory = mergeSignaturesAndHistory(signatures, historyItems);

  return allHistory;
}

async function parsePdf(pdf: Buffer): Promise<any> {
  const parser = new PdfParser();
  parser.parseBuffer(pdf);

  return new Promise((resolve, reject) => {
    parser.on('pdfParser_dataReady', resolve);
    parser.on('error', reject);
  });
}

function extractPdfAuditRows(pdfJson: any): string[] {
  const auditDateFormat = 'MM / DD / YYYY';
  const rows: string[] = [];
  pdfJson.formImage.Pages.forEach((page: any) => {
    page.Texts.forEach((T: any) => {
      T.R.forEach((R: any) => {
        const T = decodeURIComponent(R.T);
        rows.push(T);
      });
    });
  });

  return rows.slice(rows.lastIndexOf(auditDateFormat));
}

function pdfRowsToHistoryItems(rows: string[]): DocumentHistory[] {
  const dateRegex = /[0-9]{1,2} \/ [0-9]{1,2} \/ [0-9]{4}/;
  const items: DocumentHistory[] = [];

  let buildingItem = false;
  let currentItem: Partial<DocumentHistory> = {};
  const events = {
    'Sent for signature': DocumentHistoryType.SENT,
    'Viewed by': DocumentHistoryType.VIEWED,
    'Signed by': DocumentHistoryType.SIGNED,
    'The document has been completed': DocumentHistoryType.COMPLETED,
  };

  for (const [i, row] of rows.entries()) {
    if (buildingItem) {
      if (ipRegex().test(row)) {
        // eslint-disable-next-line prefer-destructuring
        currentItem.ip = row.match(ipRegex())[0];

        if (!dateRegex.test(rows[i + 1])) {
          buildingItem = false;
          items.push(currentItem as DocumentHistory);
          currentItem = {};
        }
      } else if (dateRegex.test(row)) {
        const dateTime = `${row} ${rows[i + 1]}`;
        currentItem.timestamp = moment.tz(dateTime, 'MM / DD / YYYY HH:mm:ss', 'UTC').toISOString();
        buildingItem = false;
        items.push(currentItem as DocumentHistory);
        currentItem = {};
      } else {
        currentItem.description += ` ${row}`;
      }
    } else {
      for (const [text, entryType] of Object.entries(events)) {
        if (row.startsWith(text)) {
          currentItem = {
            description: row,
            type: entryType,
          };
          buildingItem = true;
        }
      }
    }
  }

  return items;
}

function mergeSignaturesAndHistory(signatures: SignatureSummary[], history: DocumentHistory[]): DocumentHistory[] {
  if (signatures.length === 0) {
    return history;
  }

  const items: DocumentHistory[] = [];
  let historyCursor = 0;
  for (const sig of signatures) {
    while (
      history[historyCursor] &&
      (!history[historyCursor].timestamp ||
        new Date(sig.createdAt).getTime() > new Date(history[historyCursor].timestamp).getTime())
    ) {
      items.push(history[historyCursor]);
      // eslint-disable-next-line no-plusplus
      historyCursor++;
    }
    const sigHistory: DocumentHistory = {
      description: `Signed on the blockchain by ${sig.name} (${sig.email})`,
      type: DocumentHistoryType.SIGNED_ON_CHAIN,
      ip: sig.ip,
      timestamp: sig.createdAt,
      txHash: sig.txHash,
    };
    items.push(sigHistory);
  }

  return items;
}

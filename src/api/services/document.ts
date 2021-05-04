import groupBy from 'lodash/groupBy';
import HelloSign, { SignatureRequestRequestOptions } from 'hellosign-sdk';
import moment from 'moment-timezone';
import ipRegex from 'ip-regex';

import { POSTSIGN_REDIRECT_URL } from '../../env';
import { Document, DocumentHash, getConnection, Signature, SignatureTx, User } from '../../db';
import {
  DocumentDetails,
  DocumentHistory,
  DocumentHistoryType,
  DocumentListParams,
  DocumentSummary,
  PaginatedDocuments,
  SignatureInfoSigned,
  SignatureSummary,
  SignerInfo,
} from '../types';
import { NotFoundError } from '../errors';
import { readFilePromise, sha256Hex, sleep } from '../utils';
import { createOauthClient, hsApp } from './hellosign';
import { getAndUpdateHashes } from './documentHash';
import { saveSignatures } from './signature';
import { storeSignatureTx } from './signatureTx';

const PdfParser = require('pdf2json');

export async function getDocumentDetails(
  hashOrSignatureId: string,
  withHistory = false,
  skipDownload = false
): Promise<DocumentDetails> {
  const documentUid = await getDocumentUidFromHashOrSignatureId(hashOrSignatureId);
  const docSummary = await getDocumentByUid(documentUid);
  const { signature_request } = await hsApp.signatureRequest.get(documentUid);
  const docStatus = await calculateAndUpdateDocumentStatus(documentUid, signature_request);
  const createdByEmail = signature_request.requester_email_address;
  let createdByName = '';

  const signatures = docSummary.signatures.map((sig) => {
    const hsSignatureDetails = signature_request.signatures.find((s) => s.signature_id === sig.signatureUid);

    if (createdByEmail === sig.email || createdByEmail === hsSignatureDetails.signer_email_address) {
      createdByName = hsSignatureDetails.signer_name || sig.name || createdByName;
    }

    return {
      ...sig,
      hs: {
        isOwner: hsSignatureDetails.signer_email_address === signature_request.requester_email_address,
        email: hsSignatureDetails.signer_email_address,
        name: hsSignatureDetails.signer_name,
        signedAt: hsSignatureDetails.signed_at ? new Date(hsSignatureDetails.signed_at * 1000).toISOString() : null,
        statusCode: hsSignatureDetails.status_code,
      },
    };
  });

  // TODO: skip downloading the file if we know there's no updates / file is not needed
  let file: Buffer;

  if (!skipDownload) {
    file = await hsApp.tryDownloadFile(documentUid);
  }

  let hashes: string[] = [];
  if (file) {
    const hash = sha256Hex(file);
    hashes = await getAndUpdateHashes(documentUid, [hash]);
  } else {
    hashes = await getAndUpdateHashes(documentUid, []);
  }

  let history: DocumentHistory[] = [];
  if (!skipDownload && withHistory && file) {
    history = await getDocumentHistory(file, docSummary.signatures);
  }

  return {
    ...docSummary,
    createdByEmail,
    createdByName,
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

  const res = await q
    .where(`exists ${exists1.getQuery()}`)
    .orWhere(`exists ${exists2.getQuery()}`)
    .orWhere('d."documentUid" = :uid', { uid: hashOrSignatureId })
    .execute();

  if (res.length === 0) {
    throw new NotFoundError('Document not found');
  }

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
      's.payload as "payload"',
      's.status as "signatureStatus"',
      'stx.createDate as "signedAt"',
      'stx.txHash as "txHash"',
    ])
    .from(Document, 'd')
    .leftJoin(Signature, 's', 'd.id = s."documentId"')
    .leftJoin(SignatureTx, 'stx', 's.id = stx."signatureId"')
    .where('d."documentUid" in (:...uids)', { uids })
    .execute();

  const groups = groupBy(rawItems, 'documentUid');
  const foundUids = Object.keys(groups);
  const orderedUids = uids.filter((uid) => foundUids.includes(uid));

  const docsWithDetails = orderedUids.map((uid) => {
    const rows = groups[uid];
    const first = rows[0];

    const signatures = rows.map((row) => {
      const signatureDetails: SignatureSummary = {
        signatureUid: row.signatureUid,
        ip: row.ip,
        completed: row.signatureStatus === Signature.Status.SIGNED,
        email: row.email,
        name: row.name,
        payload: row.payload,
        txHash: row.txHash,
        signedAt: row.signedAt,
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

export async function listDocuments(user: User, params: DocumentListParams): Promise<PaginatedDocuments> {
  // const res = await hs.signatureRequest.list(params);
  // const uids = res.signature_requests.map((item) => item.signature_request_id);

  const connection = getConnection();

  const q = connection
    .createQueryBuilder()
    .select('"documentUid"')
    .from(Document, 'd')
    .innerJoin(User, 'u', 'u.id = d."userId"')
    .where('u.id = :id', { id: user.id });

  const offset = params.page_size * (params.page - 1);

  const rawItems = await q.addOrderBy('d."createDate"', 'DESC').limit(params.page_size).offset(offset).execute();
  const total = await q.getCount();
  const uids = rawItems.map((row: any) => row.documentUid);
  const items = await getDocumentsByUids(uids);

  // const listInfo: {
  //   page: number;
  //   // eslint-disable-next-line camelcase
  //   num_pages: number;
  //   // eslint-disable-next-line camelcase
  //   num_results: number;
  // } = (res as any).list_info;

  return {
    meta: {
      page: params.page,
      pageSize: params.page_size,
      total,
    },
    items,
  };
}

export async function sendForSignatures(user: User, data: SignatureRequestRequestOptions): Promise<DocumentDetails> {
  const hs = createOauthClient(user.oauthToken);

  const { signature_request } = await hs.signatureRequest.send({
    ...data,
    test_mode: 1,
    subject: data.title,
    signing_redirect_url: POSTSIGN_REDIRECT_URL,
  } as any);
  const doc = await saveDocument({
    documentUid: signature_request.signature_request_id,
    status: Document.Status.OUT_FOR_SIGNATURE,
    title: signature_request.title,
    userId: user.id,
  });

  // can't do this either because if same document is reused then the hash will be the same
  // which will create lookup collisions
  // this should be stored in a different place
  // if (data?.files[0]) {
  //   const file = await readFilePromise(data?.files[0]);
  //   const hash = sha256Hex(file);
  //   await getAndUpdateHashes(doc.documentUid, [hash]);
  // }
  // this won't work here because "Files are still being processed. Please try again later."
  // const file = await hs.downloadFile(signature_request.signature_request_id);
  // const hash = sha256Hex(file);
  // await getAndUpdateHashes(doc.documentUid, [hash]);
  const sigs: Partial<Signature>[] = signature_request.signatures.map((sig) => ({
    documentId: doc.id,
    signatureUid: sig.signature_id,
    status: Signature.Status.PENDING,
    recipientEmail: sig.signer_email_address,
    name: sig.signer_name,
  }));
  await saveSignatures(sigs);

  return getDocumentDetails(sigs[0].signatureUid, false, true);
}

export async function saveDocument(doc: Partial<Document>): Promise<Document> {
  const connection = getConnection();
  const createdDoc = await connection.createEntityManager().save<Document>(new Document(doc), { reload: true });

  return createdDoc;
}

export async function sign(signerInfo: SignerInfo, signatureInfo: SignatureInfoSigned): Promise<void> {
  // TODO: add checks of hashes, payload etc
  await getDocumentByUid(signerInfo.documentUid);
  const connection = getConnection();
  const sig = await connection.createEntityManager().findOne(Signature, { signatureUid: signerInfo.signatureUid });
  await saveSignatures([
    {
      ...sig,
      ip: signerInfo.ip,
      email: signerInfo.email,
      status: Signature.Status.SIGNED,
      payload: JSON.stringify(signatureInfo),
      verifier: signerInfo.verifier,
    },
  ]);
  await getAndUpdateHashes(signerInfo.documentUid, signatureInfo.documentHashes);
  await storeSignatureTx(sig.id, signatureInfo);
}

export async function getDocumentHistory(file: Buffer, signatures: SignatureSummary[]): Promise<DocumentHistory[]> {
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
  const emailRegex = /([+a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
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
        // this way we'll get the last email address that appears in the message
        // some messages contain multiple emails and the last one seems to be the creator's email
        try {
          currentItem.email = emailRegex.exec(row)[0] || currentItem.email;
        } catch (e) {
          // ignore
        }
      }
    } else {
      for (const [text, entryType] of Object.entries(events)) {
        if (row.startsWith(text)) {
          currentItem = {
            description: row,
            type: entryType,
          };
          buildingItem = true;
          try {
            currentItem.email = emailRegex.exec(row)[0] || currentItem.email;
          } catch (e) {
            // ignore
          }
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
        (sig.signedAt && new Date(sig.signedAt).getTime() > new Date(history[historyCursor].timestamp).getTime()))
    ) {
      items.push(history[historyCursor]);
      // eslint-disable-next-line no-plusplus
      historyCursor++;
    }

    if (sig.completed) {
      const sigHistory: DocumentHistory = {
        description: `Signed on the blockchain by ${sig.name} (${sig.email})`,
        email: sig.email,
        type: DocumentHistoryType.SIGNED_ON_CHAIN,
        ip: sig.ip,
        timestamp: sig.signedAt,
        txHash: sig.txHash,
      };
      items.push(sigHistory);
    }
  }

  return items;
}

export async function getHashes(hashOrSignatureId: string): Promise<string[]> {
  const documentUid = await getDocumentUidFromHashOrSignatureId(hashOrSignatureId);
  const file = await hsApp.tryDownloadFile(documentUid);
  let hashes: string[] = [];

  if (file) {
    const hash = sha256Hex(file);
    hashes = await getAndUpdateHashes(documentUid, [hash]);
  } else {
    hashes = await getAndUpdateHashes(documentUid, []);
  }

  return hashes;
}

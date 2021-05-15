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
import { readFilePromise, sha256Hex } from '../utils';
import { createOauthClient, hsApp } from './hellosign';
import { getAndUpdateHashes, getHashes } from './documentHash';
import { saveSignatures } from './signature';
import { storeSignatureTx, validateSignature } from './signatureTx';
import { MINUTE_MILLIS } from '../../constants';

const PdfParser = require('pdf2json');

export async function validate(hashOrSignatureId: string): Promise<DocumentDetails> {
  const docDetails = await getDocumentDetails(hashOrSignatureId, true);
  const VALIDATION_THRESHOLD = 5 * MINUTE_MILLIS;

  for (const sig of docDetails.signatures) {
    const now = new Date().getTime();
    // allow some time for tx to be confirmed before verifying
    const isAfterValidationThreshold = now - new Date(sig.signedAt).getTime() > VALIDATION_THRESHOLD;
    if (sig.completed && isAfterValidationThreshold) {
      await validateSignature(docDetails.documentUid, sig);
    }
  }

  return docDetails;
}

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
    hashes = await getHashes(documentUid);
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
      'd."originalHash" as "originalHash"',
      'd."createDate" as "createdAt"',
      's."signatureUid" as "signatureUid"',
      's.ip as "ip"',
      's.name as "name"',
      's.email as "email"',
      's."recipientEmail" as "recipientEmail"',
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
        recipientEmail: row.recipientEmail,
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
      originalHash: first.originalHash,
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

  let originalHash = null;
  if (data?.files[0]) {
    const file = await readFilePromise(data?.files[0]);
    originalHash = sha256Hex(file);
  }

  const doc = await saveDocument({
    documentUid: signature_request.signature_request_id,
    status: Document.Status.OUT_FOR_SIGNATURE,
    title: signature_request.title,
    userId: user.id,
    originalHash,
  });

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
  await storeSignatureTx({
    signatureId: sig.id,
    documentUid: signerInfo.documentUid,
    email: sig.recipientEmail,
    signatureInfo,
  });
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
  const rows: string[] = [];
  pdfJson.formImage.Pages.forEach((page: any) => {
    page.Texts.forEach((T: any) => {
      T.R.forEach((R: any) => {
        const T = decodeURIComponent(R.T);
        rows.push(T);
      });
    });
  });
  const auditStartTextRegex = /Sent for signature.*/;
  const dateTimeNumberOfRows = 2;
  const auditStartIndex = lastIndexOfRegex(rows, auditStartTextRegex) - dateTimeNumberOfRows;

  return rows.slice(auditStartIndex);
}

function lastIndexOfRegex(rows: string[], regex: RegExp): number {
  let lastIndex = -1;
  rows.forEach((row, i) => {
    if (regex.test(row)) {
      lastIndex = i;
    }
  });

  return lastIndex;
}

function pdfRowsToHistoryItems(rows: string[]): DocumentHistory[] {
  const dateRegex = /[0-9]{1,2} \/ [0-9]{1,2} \/ [0-9]{4}/;
  const items: DocumentHistory[] = [];
  const events = {
    'Sent for signature': DocumentHistoryType.SENT,
    'Viewed by': DocumentHistoryType.VIEWED,
    'Signed by': DocumentHistoryType.SIGNED,
    'The document has been completed': DocumentHistoryType.COMPLETED,
  };

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    for (const [text, entryType] of Object.entries(events)) {
      if (row.startsWith(text)) {
        const [description, afterDescIndex] = extractDescription(rows, i);
        const email = getLastEmail(description);
        const ip = extractIp(rows, afterDescIndex);
        const timestamp = extractTimestamp(rows, i);
        items.push({
          type: entryType,
          description,
          email,
          recipientEmail: email,
          ip,
          timestamp,
        });
      }
    }
    i += 1;
  }

  function extractDescription(rows: string[], i: number): [string, number] {
    let description = rows[i];
    let j = i + 1;
    while (!ipRegex().test(rows[j]) && !dateRegex.test(rows[j])) {
      description += ` ${rows[j]}`;
      j += 1;
    }
    return [description, j];
  }

  function extractIp(rows: string[], i: number): string {
    if (ipRegex().test(rows[i])) {
      return rows[i].match(ipRegex())[0];
    }
    return undefined;
  }

  function extractTimestamp(rows: string[], i: number): string {
    if (dateRegex.test(rows[i - 2])) {
      const dateTime = `${rows[i - 2]} ${rows[i - 1]}`;
      return moment.tz(dateTime, 'MM / DD / YYYY HH:mm:ss', 'UTC').toISOString();
    }

    return undefined;
  }

  return items;
}

function getLastEmail(str: string): string {
  const emailRegex = /([+a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;

  const matches = [];
  let prevMatchesCount = -1;

  try {
    while (matches.length !== prevMatchesCount) {
      const match = emailRegex.exec(str)[0];
      if (match) {
        matches.push(match);
      }
      prevMatchesCount += 1;
    }
  } catch {
    //
  }

  return matches.reverse()[0];
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
      let description = `Signed on the blockchain by ${sig.name} (${sig.recipientEmail})`;
      if (sig.recipientEmail !== sig.email) {
        description += ` using ${sig.email}`;
      }
      const sigHistory: DocumentHistory = {
        description,
        email: sig.email,
        recipientEmail: sig.recipientEmail,
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

export async function getHashesByHashOrSignatureId(hashOrSignatureId: string): Promise<string[]> {
  const documentUid = await getDocumentUidFromHashOrSignatureId(hashOrSignatureId);
  const file = await hsApp.tryDownloadFile(documentUid);
  let hashes: string[] = [];

  if (file) {
    const hash = sha256Hex(file);
    hashes = await getAndUpdateHashes(documentUid, [hash]);
  } else {
    hashes = await getHashes(documentUid);
  }

  return hashes;
}

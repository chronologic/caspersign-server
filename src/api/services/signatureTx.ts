import { getConnection, SignatureTx } from '../../db';
import logger from '../../logger';
import { SignatureDetails, SignatureInfoSigned } from '../types';
import { sleep } from '../utils';
import { getSignature, storeSignature as storeSignatureOnChain, waitForConfirmation } from './casperSdk';

export async function storeSignatureTx({
  signatureId,
  documentUid,
  email,
  signatureInfo,
}: {
  signatureId: number;
  documentUid: string;
  email: string;
  signatureInfo: SignatureInfoSigned;
}): Promise<string> {
  const txHash = await storeSignatureOnChain({
    documentUid,
    email,
    signatureInfo,
  });
  const connection = getConnection();
  await connection
    .createEntityManager()
    .insert(SignatureTx, { signatureId, status: SignatureTx.Status.BROADCASTED, txHash });
  confirmTx(txHash, signatureId);

  return txHash;
}

export async function confirmTx(hash: string, signatureId: number): Promise<void> {
  const connection = getConnection();
  let status = SignatureTx.Status.CONFIRMED;
  try {
    await waitForConfirmation(hash);
  } catch (e) {
    logger.error(e);
    status = SignatureTx.Status.ERROR;
  } finally {
    await connection.createEntityManager().update(SignatureTx, { signatureId }, { status });
  }
}

export async function validateSignature(documentUid: string, sig: SignatureDetails): Promise<void> {
  const blockchainSig = await getSignature({ documentUid, email: sig.recipientEmail });
  if (JSON.stringify(blockchainSig) !== sig.payload) {
    throw new Error(`Signature invalid for ${documentUid}:${sig.recipientEmail}`);
  }
}

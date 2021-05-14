import { getConnection, SignatureTx } from '../../db';
import { SignatureDetails, SignatureInfoSigned } from '../types';
import { getSignature, storeSignature as storeSignatureOnChain } from './casperSdk';

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
  // TODO: wait for tx to be confirmed
  await connection
    .createEntityManager()
    .insert(SignatureTx, { signatureId, status: SignatureTx.Status.CONFIRMED, txHash });

  return txHash;
}

export async function validateSignature(documentUid: string, sig: SignatureDetails): Promise<void> {
  const blockchainSig = await getSignature({ documentUid, email: sig.recipientEmail });
  if (JSON.stringify(blockchainSig) !== sig.payload) {
    throw new Error(`Signature invalid for ${documentUid}:${sig.recipientEmail}`);
  }
}

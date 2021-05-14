import { getConnection, SignatureTx } from '../../db';
import { SignatureInfoSigned } from '../types';
import { storeSignature as storeSignatureOnChain } from './casperSdk';

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

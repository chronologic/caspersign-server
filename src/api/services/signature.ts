import { getConnection, Signature } from '../../db';

export async function saveSignatures(sigs: Partial<Signature>[]): Promise<Signature[]> {
  const connection = getConnection();
  const storedSigs = await connection.createEntityManager().save(Signature, sigs as Signature[], { reload: true });

  return storedSigs;
}

import { Document, DocumentHash, getConnection } from '../../db';

export async function getAndUpdateHashes(documentUid: string, maybeNewHashes: string[]): Promise<string[]> {
  const connection = getConnection();
  const rawItems = await connection
    .createQueryBuilder()
    .select(['dh."hash" as "hash"'])
    .from(Document, 'd')
    .innerJoin(DocumentHash, 'dh', 'd.id = dh."documentId"')
    .where('d."documentUid" = :documentUid', { documentUid })
    .orderBy('dh."createDate"', 'ASC')
    .execute();

  const hashes: string[] = rawItems.map((item: any) => item.hash);

  for (const hash of maybeNewHashes) {
    if (!hashes.includes(hash)) {
      await storeHash(documentUid, hash);
      hashes.push(hash);
    }
  }

  return hashes;
}

async function storeHash(documentUid: string, hash: string): Promise<void> {
  const connection = getConnection();
  const doc = await connection.createEntityManager().findOne(Document, { documentUid });
  await connection.createEntityManager().insert(DocumentHash, { documentId: doc.id, hash });
}

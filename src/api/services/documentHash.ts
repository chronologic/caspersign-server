import { Document, DocumentHash, getConnection } from '../../db';

export async function getAndUpdateHashes(documentUid: string, maybeNewHashes: string[]): Promise<string[]> {
  const connection = getConnection();
  const rawItems = await connection
    .createQueryBuilder()
    .select(['dh."hash" as "hash"', 'd.id as "documentId"'])
    .from(Document, 'd')
    .innerJoin(DocumentHash, 'dh', 'd.id = dh."documentId"')
    .where('d."documentUid" = :documentUid', { documentUid })
    .orderBy('dh."createDate"', 'ASC')
    .execute();

  const hashes: string[] = rawItems.map((item: any) => item.hash);

  for (const hash of maybeNewHashes) {
    if (!hashes.includes(hash)) {
      const { documentId } = rawItems[0];
      await storeHash(documentId, hash);
      hashes.push(hash);
    }
  }

  return hashes;
}

async function storeHash(documentId: number, maybeNewHash: string): Promise<void> {
  const connection = getConnection();
  await connection.createEntityManager().insert(DocumentHash, { documentId, hash: maybeNewHash });
}

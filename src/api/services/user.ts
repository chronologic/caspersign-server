import { Document, getConnection, User } from '../../db';

export async function getDocumentOwner(documentUid: string): Promise<User> {
  const connection = getConnection();
  const res = await connection
    .createQueryBuilder()
    .select('d.id as "id"')
    .from(User, 'u')
    .innerJoin(Document, 'd', 'd."userId" = u.id')
    .where('d."documentUid" = :documentUid', { documentUid })
    .execute();

  const { id } = res[0];

  return connection.createEntityManager().findOne(User, id);
}

export async function updateUser(id: number, user: Partial<User>): Promise<void> {
  const connection = getConnection();
  await connection.createEntityManager().update(User, { id }, user);
}

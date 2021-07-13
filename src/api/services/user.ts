import { SECOND_MILLIS } from '../../constants';
import { Document, getConnection, User } from '../../db';
import { HsOauthResponse } from '../types';
import { createOauthClient, hsApp } from './hellosign';

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

export async function oauth(code: string, state: string): Promise<User> {
  const res: HsOauthResponse = (await hsApp.oauth.getToken({ code, state })) as any;
  const oauthTokenExpirationDate = new Date(new Date().getTime() + res.expires_in * SECOND_MILLIS);
  const hs = createOauthClient(res.access_token);
  const { account } = await hs.account.get();
  const user = await getUserByEmail(account.email_address);

  return saveUser({
    ...user,
    email: account.email_address,
    oauthToken: res.access_token,
    oauthTokenExpirationDate,
    refreshToken: res.refresh_token,
  });
}

export async function getUserByEmail(email: string): Promise<User> {
  const connection = getConnection();
  return connection.createEntityManager().findOne(User, { email: email.toLowerCase() });
}

export async function getUserByToken(token: string): Promise<User> {
  const connection = getConnection();
  return connection.createEntityManager().findOne(User, { oauthToken: token });
}

export async function saveUser(user: Partial<User>): Promise<User> {
  const connection = getConnection();
  const savedUser = await connection.createEntityManager().save(User, user, { reload: true });

  return savedUser;
}

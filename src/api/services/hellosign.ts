import HS from 'hellosign-sdk';

import { HS_CLIENT_ID, HS_OAUTH_SECRET, HS_API_KEY } from '../../env';

interface HsApiData {
  auth: string;
  host: string;
  port: string;
  basePath: string;
  timeout: 0;
  dev: boolean;
  clientId: string;
  clientSecret: string;
  oauthToken: string;
}

export class HsExtended extends HS {
  downloadFile(signatureId: string): Promise<Buffer> {
    const hs = this;
    return new Promise((resolve, reject) => {
      hs.signatureRequest.download(signatureId, { file_type: 'pdf' }, (err, response) => {
        if (err) {
          reject(err);
        } else {
          const buffers: any[] = [];

          response.on('data', (chunk) => buffers.push(chunk));
          response.on('close', () => resolve(Buffer.concat(buffers)));
          response.on('error', (err) => reject(err));
        }
      });
    });
  }

  // eslint-disable-next-line no-underscore-dangle
  _api: HsApiData = (this as any)._api;
}

export const hsApp = new HsExtended({
  client_id: HS_CLIENT_ID,
  client_secret: HS_OAUTH_SECRET,
  key: HS_API_KEY,
});

export function createOauthClient(oauthToken: string): HsExtended {
  return new HsExtended({ oauthToken, client_id: HS_CLIENT_ID } as any);
}

// export async function getHsForUser(user: User): Promise<HsExtended> {
//   const now = new Date().getTime();
//   const client = createOauthClient(user.oauthToken);
//   const isTokenExpired = new Date(user.oauthTokenExpirationDate).getTime() - now < MINUTE_MILLIS;

//   if (!user.oauthTokenExpirationDate || isTokenExpired) {
//     const res = await client.oauth.refreshToken(user.refreshToken);
//     const newRefreshToken = res.oauth.refresh_token;
//     const newExpirationDate = new Date(new Date().getTime() + 86400 * SECOND_MILLIS);
//     const newOauthToken = client._api.oauthToken.replace('Bearer ', '');

//     await updateUser(user.id, {
//       oauthToken: newOauthToken,
//       oauthTokenExpirationDate: newExpirationDate,
//       refreshToken: newRefreshToken,
//     });
//   }

//   return client;
// }

// hsApp.signatureRequest
//   .list({
//     page_size: 3,
//   })
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((e) => console.error(e));

// // eslint-disable-next-line no-underscore-dangle
// console.log(hsApp._api);

// const client = createOauthClient('assdfsdfdsfsd');
// console.log(client._api);

// // hsApp
// //   .downloadFile('6a3f5002131851fcb4278cb548449294bef44027')
// //   .then((res) => console.log(res.length))
// //   .catch((err) => console.error(err));

// hsApp.signatureRequest
//   .list({ page_size: 3 })
//   .then((res) => {
//     console.log(res);
//   })
//   .catch(console.error);

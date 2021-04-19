import HS from 'hellosign-sdk';

import { HS_CLIENT_ID, HS_OAUTH_SECRET, HS_API_KEY } from '../../env';

export const hsApp = new HS({ client_id: HS_CLIENT_ID, client_secret: HS_OAUTH_SECRET, key: HS_API_KEY });

export function createOauthClient(oauthToken: string): HS {
  return new HS({ oauthToken, client_id: HS_CLIENT_ID } as any);
}

// hsApp.signatureRequest
//   .list({
//     page_size: 3,
//   })
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((e) => console.error(e));

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

  // right after a document has been edited (created / signed / etc)
  // hellosign will return a 'files still being processed' error
  // so this aims to handle that gracefully
  async tryDownloadFile(signatureId: string): Promise<Buffer> {
    try {
      const res = await this.downloadFile(signatureId);
      return res;
    } catch (err) {
      if (err?.message.toLowerCase().includes('still being processed')) {
        return undefined;
      }

      throw err;
    }
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

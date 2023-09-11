import { CasperClient, Keys, CasperServiceByJsonRPC } from 'casper-js-sdk';

import { CASPER_NODE_URL } from '../../env';

const client = new CasperClient(CASPER_NODE_URL);
const jsonRpcClient = new CasperServiceByJsonRPC(CASPER_NODE_URL);

export const casperJsSdk = {
  client,
  jsonRpcClient,
};

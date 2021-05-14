import { CasperClient, Keys, CasperServiceByJsonRPC } from 'casper-client-sdk';
import fs from 'fs';

import { CASPER_NODE_URL, CASPER_PK_PEM, CASPER_PUB_PEM } from '../../env';
import logger from '../../logger';

const casperPubPath = './casper_public.pem';
const casperPkPath = './casper_private.pem';

if (!fs.existsSync(casperPubPath)) {
  fs.writeFileSync(casperPubPath, CASPER_PUB_PEM);
}
if (!fs.existsSync(casperPkPath)) {
  fs.writeFileSync(casperPkPath, CASPER_PK_PEM);
}

export const client = new CasperClient(CASPER_NODE_URL);

export const jsonRpcClient = new CasperServiceByJsonRPC(CASPER_NODE_URL);

export const keypair = Keys.Ed25519.parseKeyFiles(casperPubPath, casperPkPath);

logger.info(`Casper wallet is ${keypair.accountHex()}`);

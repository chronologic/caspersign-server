import { CasperClient, Keys, DeployUtil, CLValue } from 'casper-client-sdk';
import fs from 'fs';

import { CASPER_CHAIN_NAME, CASPER_EVENT_STORE_URL, CASPER_NODE_URL, CASPER_PK_PEM } from '../../env';
import logger from '../../logger';
import { getConnection, SignatureTx } from '../../db';
import { SignatureInfoSigned } from '../types';

const client = new CasperClient(CASPER_NODE_URL, CASPER_EVENT_STORE_URL);

// create new wallet
// const res = client.newKeyPair(Keys.SignatureAlgorithm.Ed25519);
// console.log(res.exportPrivateKeyInPem());
// console.log(res.exportPublicKeyInPem());

const casperPkPath = './casper_private.pem';
fs.writeFileSync(casperPkPath, CASPER_PK_PEM);
const keypair = client.loadKeyPairFromPrivateFile(casperPkPath, Keys.SignatureAlgorithm.Ed25519);

logger.info(`Casper wallet is ${keypair.accountHex()}`);

export async function storeSignatureTx(signatureId: number, signatureInfo: SignatureInfoSigned): Promise<string> {
  const txHash = await storeSignatureInfoOnChain(signatureInfo);
  const connection = getConnection();
  // TODO: wait for tx to be confirmed
  await connection
    .createEntityManager()
    .insert(SignatureTx, { signatureId, status: SignatureTx.Status.CONFIRMED, txHash });

  return txHash;
}

// TODO: fix tx deployment
async function storeSignatureInfoOnChain(signatureInfo: SignatureInfoSigned): Promise<string> {
  const deployParams = new DeployUtil.DeployParams(keypair.publicKey, CASPER_CHAIN_NAME);
  const session = DeployUtil.ExecutableDeployItem.newTransfer('0', keypair.publicKey);
  const payment = DeployUtil.standardPayment('0');
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
  let signatureDeploy = DeployUtil.addArgToDeploy(deploy, 'verifier', CLValue.string(signatureInfo.verifier));
  signatureDeploy = DeployUtil.addArgToDeploy(signatureDeploy, 'signerHash', CLValue.string(signatureInfo.signerHash));
  signatureDeploy = DeployUtil.addArgToDeploy(
    signatureDeploy,
    'recipientHash',
    CLValue.string(signatureInfo.recipientHash)
  );
  signatureDeploy = DeployUtil.addArgToDeploy(signatureDeploy, 'ipHash', CLValue.string(signatureInfo.ipHash));
  signatureDeploy = DeployUtil.addArgToDeploy(signatureDeploy, 'timestamp', CLValue.u64(signatureInfo.timestamp));
  signatureDeploy = DeployUtil.addArgToDeploy(
    signatureDeploy,
    'originalDocumentHash',
    CLValue.string(signatureInfo.originalDocumentHash)
  );
  signatureDeploy = DeployUtil.addArgToDeploy(
    signatureDeploy,
    'otherSignatures',
    CLValue.stringList(signatureInfo.otherSignatures)
  );
  signatureDeploy = DeployUtil.addArgToDeploy(
    signatureDeploy,
    'documentHashes',
    CLValue.stringList(signatureInfo.documentHashes)
  );
  signatureDeploy = DeployUtil.addArgToDeploy(
    signatureDeploy,
    'signerPubkey',
    CLValue.string(signatureInfo.signerPubkey)
  );
  signatureDeploy = DeployUtil.addArgToDeploy(signatureDeploy, 'signature', CLValue.string(signatureInfo.signature));
  const signedDeploy = DeployUtil.signDeploy(signatureDeploy, keypair);
  // const txHash = await client.putDeploy(signedDeploy);

  // const signedDeploy = DeployUtil.signDeploy(deploy, keypair);
  // const txHash = await client.putDeploy(signedDeploy);

  // return txHash;
  return (DeployUtil.deployToJson(signedDeploy).deploy as any).hash;
}

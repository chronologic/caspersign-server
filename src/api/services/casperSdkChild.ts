import { DeployUtil, PublicKey, CLValue, RuntimeArgs } from 'casper-client-sdk';

import { CASPER_CHAIN_NAME } from '../../env';
import { createLogger } from '../../logger';
import { CasperSdkMsg, SignatureInfoSigned } from '../types';
import { sha256Hex } from '../utils';
import { client, keypair } from './casperSdkClient';

const logger = createLogger('casperSdkChild');

logger.info('process started');

process.on('message', async (msg: CasperSdkMsg) => {
  try {
    switch (msg.method) {
      case 'sendTransfer': {
        const res = await sendTransfer(msg.payload);
        return process.send({ ...msg, payload: res });
      }
      case 'storeSignature': {
        const res = await storeSignature(msg.payload);
        return process.send({ ...msg, payload: res });
      }
      default: {
        return process.send({ ...msg, error: 'method not found' });
      }
    }
  } catch (e) {
    return process.send({ ...msg, error: e?.message || 'error' });
  }
});

async function sendTransfer({ from, to, amount }: { from: string; to: string; amount: number }) {
  // for native-transfers payment price is fixed
  const paymentAmount = 10000000000;
  // transfer_id field in the request to tag the transaction and to correlate it to your back-end storage
  const id = 187821;
  // gas price for native transfers can be set to 1
  const gasPrice = 1;
  // time that the Deploy will remain valid for, in milliseconds, the default value is 1800000, which is 30 minutes
  const ttl = 1800000;

  const deployParams = new DeployUtil.DeployParams(keypair.publicKey, CASPER_CHAIN_NAME, gasPrice, ttl);

  // we create public key from account-address (in fact it is hex representation of public-key with added prefix)
  const toPublicKey = PublicKey.fromHex(to);

  const session = DeployUtil.ExecutableDeployItem.newTransfer(amount, toPublicKey, null, id);
  // console.log(session.asTransfer().toBytes().toString());
  const payment = DeployUtil.standardPayment(paymentAmount);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
  const signedDeploy = DeployUtil.signDeploy(deploy, keypair);

  // we are sending the signed deploy
  // const res = await casperClient.putDeploy(signedDeploy);
  // console.log(res);

  const jsonFromDeploy = DeployUtil.deployToJson(signedDeploy);
  return jsonFromDeploy;
}

async function storeSignature({
  documentUid,
  email,
  signatureInfo,
}: {
  documentUid: string;
  email: string;
  signatureInfo: SignatureInfoSigned;
}): Promise<string> {
  const deployParams = new DeployUtil.DeployParams(keypair.publicKey, CASPER_CHAIN_NAME);
  const hash = sha256Hex(`${documentUid}:${email}`);
  const session = DeployUtil.ExecutableDeployItem.newStoredContractByName(
    'caspersign_contract',
    'store_signature',
    RuntimeArgs.fromMap({
      hash: CLValue.string(hash),
      signature: CLValue.string(JSON.stringify(signatureInfo)),
    })
  );
  const payment = DeployUtil.standardPayment(8e8);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
  const signedDeploy = DeployUtil.signDeploy(deploy, keypair);

  const txHash = await client.putDeploy(signedDeploy);

  return txHash;
}

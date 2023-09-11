import { fork } from 'child_process';

import { MINUTE_MILLIS, SECOND_MILLIS } from '../../constants';
import { CASPER_CONTRACT_HASH } from '../../env';
import { CasperSdkMsg, SignatureInfoSigned } from '../types';
import { createTimedCache, sha256Hex, sleep } from '../utils';
import { jsonRpcClient } from './casperSdkClient';
import { casperJsSdk } from './casperJsSdk';

// execute casper sdk deploys in a separate process because it fails when typeorm package is in scope
// this is probably due to typeorm modifying some global object casper sdk relies on
const forked = fork(`${__dirname}/casperSdkChild`);

let msgId = 0;
const cache = createTimedCache(MINUTE_MILLIS);

export async function getSignature({
  documentUid,
  email,
}: {
  documentUid: string;
  email: string;
}): Promise<SignatureInfoSigned> {
  const sigKey = sha256Hex(`${documentUid}:${email}`);
  const stateRootHash = await getStateRootHash();
  const res = await jsonRpcClient.getBlockState(stateRootHash, CASPER_CONTRACT_HASH, [sigKey]);

  return JSON.parse(res.CLValue.asString()) as SignatureInfoSigned;
}

async function getStateRootHash(): Promise<string> {
  const stateRootHashKey = 'stateRootHash';

  if (cache.get(stateRootHashKey)) {
    return cache.get(stateRootHashKey);
  }

  const latestBlock = await jsonRpcClient.getLatestBlockInfo();
  const stateRootHash = await casperJsSdk.jsonRpcClient.getStateRootHash(latestBlock.block.hash);

  cache.put(stateRootHashKey, stateRootHash);

  return stateRootHash;
}

// eslint-disable-next-line consistent-return
export async function waitForConfirmation(hash: string): Promise<void> {
  try {
    const res = await jsonRpcClient.getDeployInfo(hash);

    if (res.execution_results.length === 0) {
      await sleep(15 * SECOND_MILLIS);
      return waitForConfirmation(hash);
    }

    if ((res.execution_results[0].result as any).Failure) {
      throw new Error((res.execution_results[0].result as any).Failure.error_message || `deploy ${hash} failed`);
    }
  } catch (e) {
    if (e.message?.includes('deploy not known')) {
      await sleep(15 * SECOND_MILLIS);
      return waitForConfirmation(hash);
    }
    throw e;
  }
}

export async function sendTransfer(payload: { from: string; to: string; amount: number }) {
  return execInChild({ method: 'sendTransfer', payload });
}

export async function storeSignature(payload: {
  documentUid: string;
  email: string;
  signatureInfo: SignatureInfoSigned;
}): Promise<string> {
  return execInChild({ method: 'storeSignature', payload });
}

async function execInChild(args: Pick<CasperSdkMsg, 'method' | 'payload'>): Promise<any> {
  // eslint-disable-next-line no-plusplus
  const id = msgId++;
  return new Promise((resolve, reject) => {
    forked.send({ ...args, id } as CasperSdkMsg);

    // eslint-disable-next-line consistent-return
    forked.on('message', (msg: CasperSdkMsg) => {
      if (msg.id === id) {
        if (msg.error) {
          return reject(msg.error);
        }

        return resolve(msg.payload);
      }
    });
  });
}

import { fork } from 'child_process';

import { CasperSdkMsg, SignatureInfoSigned } from '../types';

// execute casper sdk deploys in a separate process because it fails when typeorm package is in scope
// this is probably due to typeorm modifying some global object casper sdk relies on
const forked = fork(`${__dirname}/casperSdkChild`);
let msgId = 0;

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
